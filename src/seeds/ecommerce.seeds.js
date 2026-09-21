import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import {
  AvailableOrderStatuses,
  AvailablePaymentProviders,
  UserRolesEnum,
} from "@/constants.js";
import { dbInstance } from "@/db/index.js";
import { users } from "@/models/apps/auth/user.models.js";
import { addresses } from "@/models/apps/ecommerce/address.models.js";
import { categories } from "@/models/apps/ecommerce/category.models.js";
import { coupons } from "@/models/apps/ecommerce/coupon.models.js";
import {
  ecomOrderItems,
  ecomOrders,
} from "@/models/apps/ecommerce/order.models.js";
import {
  productSubImages,
  products,
} from "@/models/apps/ecommerce/product.models.js";
import { ecomProfiles } from "@/models/apps/ecommerce/profile.models.js";
import { ApiError } from "@/utils/ApiError.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { asyncHandler } from "@/utils/asyncHandler.js";
import { getRandomNumber } from "@/utils/helpers.js";
import {
  ADDRESSES_COUNT,
  CATEGORIES_COUNT,
  COUPONS_COUNT,
  ORDERS_COUNT,
  ORDERS_RANDOM_ITEMS_COUNT,
  PRODUCTS_COUNT,
  PRODUCTS_SUB_IMAGES_COUNT,
} from "@/seeds/_constants.js";

const requireDb = () => {
  if (!dbInstance) {
    throw new ApiError(500, "Database is not connected");
  }
  return dbInstance;
};

const categoryBlueprints = new Array(CATEGORIES_COUNT).fill("_").map(() => ({
  name: faker.commerce.productAdjective().toLowerCase(),
}));

const addressBlueprints = new Array(ADDRESSES_COUNT).fill("_").map(() => ({
  addressLine1: faker.location.streetAddress(),
  addressLine2: faker.location.street(),
  city: faker.location.city(),
  country: faker.location.country(),
  pincode: faker.location.zipCode("######"),
  state: faker.location.state(),
}));

const couponBlueprints = new Array(COUPONS_COUNT).fill("_").map(() => {
  const discountValue = faker.number.int({
    max: 1000,
    min: 100,
  });

  return {
    name: faker.lorem.word({
      length: {
        max: 15,
        min: 8,
      },
    }),
    couponCode: (
      faker.lorem.word({
        length: {
          max: 8,
          min: 5,
        },
      }) + `${discountValue}`
    ).toUpperCase(),
    discountValue,
    isActive: faker.datatype.boolean(),
    minimumCartValue: discountValue + 300,
    startDate: faker.date.anytime(),
    expiryDate: faker.date.future({
      years: 3,
    }),
  };
});

const productBlueprints = new Array(PRODUCTS_COUNT).fill("_").map(() => ({
  name: faker.commerce.productName(),
  description: faker.commerce.productDescription(),
  mainImageUrl: faker.image.urlLoremFlickr({
    category: "product",
  }),
  mainImageLocalPath: "",
  price: +faker.commerce.price({ dec: 0, min: 200, max: 500 }),
  stock: +faker.commerce.price({ dec: 0, min: 10, max: 200 }),
  subImages: new Array(PRODUCTS_SUB_IMAGES_COUNT).fill("_").map(() => ({
    url: faker.image.urlLoremFlickr({
      category: "product",
    }),
    localPath: "",
  })),
}));

const orderBlueprints = new Array(ORDERS_COUNT).fill("_").map(() => {
  const paymentProvider =
    AvailablePaymentProviders[
      getRandomNumber(AvailablePaymentProviders.length)
    ];
  return {
    status:
      AvailableOrderStatuses[getRandomNumber(AvailableOrderStatuses.length)],
    paymentProvider: paymentProvider === "UNKNOWN" ? "PAYPAL" : paymentProvider,
    paymentId: faker.string.alphanumeric({
      casing: "mixed",
      length: 24,
    }),
    isPaymentDone: true,
  };
});

const seedEcomProfiles = async (db) => {
  const profiles = await db.select().from(ecomProfiles);
  await Promise.all(
    profiles.map((profile) =>
      db
        .update(ecomProfiles)
        .set({
          firstName: faker.person.firstName(),
          lastName: faker.person.lastName(),
          countryCode: "+91",
          phoneNumber: faker.phone.number("9#########"),
        })
        .where(eq(ecomProfiles.id, profile.id))
    )
  );
};

const seedEcomCategories = async (db, ownerId) => {
  await db.delete(categories);
  if (categoryBlueprints.length === 0) return [];
  return db
    .insert(categories)
    .values(categoryBlueprints.map((cat) => ({ ...cat, owner: ownerId })))
    .returning();
};

const seedEcomAddresses = async (db, allUsers) => {
  await db.delete(addresses);
  if (addressBlueprints.length === 0) return [];
  return db
    .insert(addresses)
    .values(
      addressBlueprints.map((add, i) => ({
        ...add,
        owner: allUsers[i]?.id ?? allUsers[getRandomNumber(allUsers.length)]?.id,
      }))
    )
    .returning();
};

const seedEcomCoupons = async (db, ownerId) => {
  await db.delete(coupons);
  if (couponBlueprints.length === 0) return [];
  return db
    .insert(coupons)
    .values(couponBlueprints.map((coupon) => ({ ...coupon, owner: ownerId })))
    .returning();
};

const seedEcomProducts = async (db, allUsers, allCategories) => {
  await db.delete(products); // cascades product_sub_images

  const createdProducts = [];

  for (const blueprint of productBlueprints) {
    const { subImages, ...productFields } = blueprint;
    const [product] = await db
      .insert(products)
      .values({
        ...productFields,
        owner: allUsers[getRandomNumber(allUsers.length)]?.id,
        category: allCategories[getRandomNumber(allCategories.length)]?.id,
      })
      .returning();

    if (subImages.length > 0) {
      await db.insert(productSubImages).values(
        subImages.map((img) => ({
          productId: product.id,
          url: img.url,
          localPath: img.localPath,
        }))
      );
    }

    createdProducts.push(product);
  }

  return createdProducts;
};

const seedEcomOrders = async (
  db,
  allUsers,
  allCoupons,
  allProducts,
  allAddresses
) => {
  const orderPayload = new Array(ORDERS_RANDOM_ITEMS_COUNT).fill("_").map(() => {
    const totalOrderProducts = getRandomNumber(5);
    const orderItems = allProducts
      .slice(0, totalOrderProducts > 1 ? totalOrderProducts : 2)
      .map((prod) => ({
        productId: prod.id,
        quantity: +faker.commerce.price({ dec: 0, min: 1, max: 5 }),
        price: prod.price,
      }));

    const orderPrice = orderItems.reduce(
      (prev, curr) => prev + curr.price * curr.quantity,
      0
    );

    let coupon = allCoupons[getRandomNumber(allCoupons.length + 20)] ?? null;
    let discountedOrderPrice = orderPrice;
    if (coupon && coupon.minimumCartValue <= orderPrice) {
      discountedOrderPrice -= coupon.discountValue;
    } else {
      coupon = null;
    }

    return {
      orderItems: orderItems.map((prod) => ({
        productId: prod.productId,
        quantity: prod.quantity,
      })),
      orderPrice,
      discountedOrderPrice,
      coupon,
    };
  });

  await db.delete(ecomOrders); // cascades ecom_order_items

  for (const order of orderBlueprints) {
    const customer = allUsers[getRandomNumber(allUsers.length)];
    const orderInstance = orderPayload[getRandomNumber(orderPayload.length)];
    const address =
      allAddresses.find((add) => add.owner === customer?.id) ||
      allAddresses[getRandomNumber(allAddresses.length)];

    const [created] = await db
      .insert(ecomOrders)
      .values({
        status: order.status,
        paymentProvider: order.paymentProvider,
        paymentId: order.paymentId,
        isPaymentDone: order.isPaymentDone,
        customer: customer?.id,
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2,
        city: address.city,
        country: address.country,
        pincode: address.pincode,
        state: address.state,
        coupon: orderInstance.coupon?.id ?? null,
        orderPrice: orderInstance.orderPrice,
        discountedOrderPrice: orderInstance.discountedOrderPrice,
      })
      .returning();

    if (orderInstance.orderItems.length > 0) {
      await db.insert(ecomOrderItems).values(
        orderInstance.orderItems.map((item) => ({
          orderId: created.id,
          productId: item.productId,
          quantity: item.quantity,
        }))
      );
    }
  }
};

/**
 * Wipe ecommerce domain tables in FK-safe order before re-seeding.
 * Orders/items → products/sub-images → categories/addresses/coupons.
 */
const clearEcommerceDomain = async (db) => {
  await db.delete(ecomOrders);
  await db.delete(products);
  await db.delete(categories);
  await db.delete(addresses);
  await db.delete(coupons);
};

const seedEcommerce = asyncHandler(async (req, res) => {
  const db = requireDb();

  const [owner] = await db
    .select()
    .from(users)
    .where(eq(users.role, UserRolesEnum.ADMIN))
    .limit(1);

  if (!owner) {
    throw new ApiError(
      500,
      "Something went wrong while seeding the data. Please try again once"
    );
  }

  await clearEcommerceDomain(db);

  await seedEcomProfiles(db);

  const allCategories = await seedEcomCategories(db, owner.id);
  const allUsers = await db.select().from(users);
  const allAddresses = await seedEcomAddresses(db, allUsers);
  const allCoupons = await seedEcomCoupons(db, owner.id);
  const allProducts = await seedEcomProducts(db, allUsers, allCategories);
  await seedEcomOrders(db, allUsers, allCoupons, allProducts, allAddresses);

  return res
    .status(201)
    .json(
      new ApiResponse(201, {}, "Database populated for ecommerce successfully")
    );
});

export { seedEcommerce };
