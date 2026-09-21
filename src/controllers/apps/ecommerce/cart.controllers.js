import { and, eq } from "drizzle-orm";
import { dbInstance } from "@/db/index.js";
import {
  cartItems,
  carts,
} from "@/models/apps/ecommerce/cart.models.js";
import { coupons } from "@/models/apps/ecommerce/coupon.models.js";
import { products } from "@/models/apps/ecommerce/product.models.js";
import { shapeProduct, withId } from "@/models/serializers.js";
import {
  getShapedProductById,
  loadSubImagesByProductIds,
} from "@/controllers/apps/ecommerce/product.controllers.js";
import { ApiError } from "@/utils/ApiError.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { asyncHandler } from "@/utils/asyncHandler.js";

const requireDb = () => {
  if (!dbInstance) {
    throw new ApiError(500, "Database is not connected");
  }
  return dbInstance;
};

const emptyCartPayload = {
  _id: null,
  items: [],
  cartTotal: 0,
  discountedTotal: 0,
};

/**
 * @param {string} userId
 * @description Returns cart in API shape:
 * `{ _id, items: [{ _id, product, quantity }], cartTotal, discountedTotal, coupon? }`
 */
export const getCart = async (userId) => {
  const db = requireDb();

  const [cart] = await db
    .select()
    .from(carts)
    .where(eq(carts.owner, userId))
    .limit(1);

  if (!cart) {
    return { ...emptyCartPayload };
  }

  const itemRows = await db
    .select({
      id: cartItems.id,
      quantity: cartItems.quantity,
      product: products,
    })
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .where(eq(cartItems.cartId, cart.id));

  // Empty cart has no items — fall through to fallback empty items array
  if (itemRows.length === 0) {
    return { ...emptyCartPayload };
  }

  const subMap = await loadSubImagesByProductIds(
    db,
    itemRows.map((row) => row.product.id)
  );

  const items = itemRows.map((row) => ({
    _id: row.id,
    quantity: row.quantity,
    product: shapeProduct(row.product, subMap.get(row.product.id) ?? []),
  }));

  const cartTotal = items.reduce(
    (sum, item) => sum + Number(item.product.price ?? 0) * item.quantity,
    0
  );

  let coupon = null;
  if (cart.coupon) {
    const [couponRow] = await db
      .select()
      .from(coupons)
      .where(eq(coupons.id, cart.coupon))
      .limit(1);
    coupon = couponRow ? withId(couponRow) : null;
  }

  const discountedTotal = coupon
    ? cartTotal - Number(coupon.discountValue ?? 0)
    : cartTotal;

  return {
    _id: cart.id,
    items,
    cartTotal,
    discountedTotal,
    coupon,
  };
};

const getUserCart = asyncHandler(async (req, res) => {
  const cart = await getCart(req.user._id);

  return res
    .status(200)
    .json(new ApiResponse(200, cart, "Cart fetched successfully"));
});

const addItemOrUpdateItemQuantity = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { productId } = req.params;
  const { quantity = 1 } = req.body;

  const [cart] = await db
    .select()
    .from(carts)
    .where(eq(carts.owner, req.user._id))
    .limit(1);

  if (!cart) {
    throw new ApiError(404, "Cart does not exist");
  }

  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!product) {
    throw new ApiError(404, "Product does not exist");
  }

  if (quantity > product.stock) {
    throw new ApiError(
      400,
      product.stock > 0
        ? "Only " +
          product.stock +
          " products are remaining. But you are adding " +
          quantity
        : "Product is out of stock"
    );
  }

  const [existingItem] = await db
    .select()
    .from(cartItems)
    .where(
      and(eq(cartItems.cartId, cart.id), eq(cartItems.productId, productId))
    )
    .limit(1);

  if (existingItem) {
    await db
      .update(cartItems)
      .set({ quantity: Number(quantity) })
      .where(eq(cartItems.id, existingItem.id));

    if (cart.coupon) {
      await db
        .update(carts)
        .set({ coupon: null })
        .where(eq(carts.id, cart.id));
    }
  } else {
    await db.insert(cartItems).values({
      cartId: cart.id,
      productId,
      quantity: Number(quantity),
    });
  }

  const newCart = await getCart(req.user._id);

  return res
    .status(200)
    .json(new ApiResponse(200, newCart, "Item added successfully"));
});

const removeItemFromCart = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { productId } = req.params;

  const product = await getShapedProductById(db, productId);
  if (!product) {
    throw new ApiError(404, "Product does not exist");
  }

  const [cart] = await db
    .select()
    .from(carts)
    .where(eq(carts.owner, req.user._id))
    .limit(1);

  if (!cart) {
    throw new ApiError(404, "Cart does not exist");
  }

  await db
    .delete(cartItems)
    .where(
      and(eq(cartItems.cartId, cart.id), eq(cartItems.productId, productId))
    );

  let hydrated = await getCart(req.user._id);

  if (hydrated.coupon && hydrated.cartTotal < hydrated.coupon.minimumCartValue) {
    await db
      .update(carts)
      .set({ coupon: null })
      .where(eq(carts.id, cart.id));
    hydrated = await getCart(req.user._id);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, hydrated, "Cart item removed successfully"));
});

const clearCart = asyncHandler(async (req, res) => {
  const db = requireDb();

  const [cart] = await db
    .select()
    .from(carts)
    .where(eq(carts.owner, req.user._id))
    .limit(1);

  if (cart) {
    await db.delete(cartItems).where(eq(cartItems.cartId, cart.id));
    await db
      .update(carts)
      .set({ coupon: null })
      .where(eq(carts.id, cart.id));
  }

  const hydrated = await getCart(req.user._id);

  return res
    .status(200)
    .json(new ApiResponse(200, hydrated, "Cart has been cleared"));
});

export {
  getUserCart,
  addItemOrUpdateItemQuantity,
  removeItemFromCart,
  clearCart,
};
