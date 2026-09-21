import { and, count, eq, gt, lt, lte, ne } from "drizzle-orm";
import { CouponTypeEnum } from "@/constants.js";
import { getCart } from "@/controllers/apps/ecommerce/cart.controllers.js";
import { dbInstance } from "@/db/index.js";
import { carts } from "@/models/apps/ecommerce/cart.models.js";
import { coupons } from "@/models/apps/ecommerce/coupon.models.js";
import { withId } from "@/models/serializers.js";
import { ApiError } from "@/utils/ApiError.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { asyncHandler } from "@/utils/asyncHandler.js";
import { aggregatePaginate } from "@/utils/helpers.js";

const requireDb = () => {
  if (!dbInstance) {
    throw new ApiError(500, "Database is not connected");
  }
  return dbInstance;
};

const toDate = (value) => (value == null ? undefined : new Date(value));

const createCoupon = asyncHandler(async (req, res) => {
  const db = requireDb();
  const {
    name,
    couponCode,
    type = CouponTypeEnum.FLAT,
    discountValue,
    minimumCartValue,
    startDate,
    expiryDate,
  } = req.body;

  const normalizedCode = couponCode.trim().toUpperCase();

  const [duplicateCoupon] = await db
    .select()
    .from(coupons)
    .where(eq(coupons.couponCode, normalizedCode))
    .limit(1);

  if (duplicateCoupon) {
    throw new ApiError(
      409,
      "Coupon with code " + duplicateCoupon.couponCode + " already exists"
    );
  }

  if (minimumCartValue && +minimumCartValue < +discountValue) {
    throw new ApiError(
      400,
      "Minimum cart value must be greater than or equal to the discount value"
    );
  }

  const [coupon] = await db
    .insert(coupons)
    .values({
      name,
      couponCode: normalizedCode,
      type,
      discountValue: Number(discountValue),
      minimumCartValue:
        minimumCartValue != null ? Number(minimumCartValue) : undefined,
      startDate: toDate(startDate),
      expiryDate: toDate(expiryDate),
      owner: req.user._id,
    })
    .returning();

  return res
    .status(201)
    .json(new ApiResponse(201, withId(coupon), "Coupon created successfully"));
});

const applyCoupon = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { couponCode } = req.body;
  const now = new Date();
  const normalizedCode = couponCode.trim().toUpperCase();

  const [coupon] = await db
    .select()
    .from(coupons)
    .where(
      and(
        eq(coupons.couponCode, normalizedCode),
        lt(coupons.startDate, now),
        gt(coupons.expiryDate, now),
        eq(coupons.isActive, true)
      )
    )
    .limit(1);

  if (!coupon) {
    throw new ApiError(404, "Invalid coupon code");
  }

  const userCart = await getCart(req.user._id);

  if (userCart.cartTotal < coupon.minimumCartValue) {
    throw new ApiError(
      400,
      "Add items worth INR " +
        (coupon.minimumCartValue - userCart.cartTotal) +
        "/- or more to apply this coupon"
    );
  }

  await db
    .update(carts)
    .set({ coupon: coupon.id })
    .where(eq(carts.owner, req.user._id));

  const newCart = await getCart(req.user._id);

  return res
    .status(200)
    .json(new ApiResponse(200, newCart, "Coupon applied successfully"));
});

const removeCouponFromCart = asyncHandler(async (req, res) => {
  const db = requireDb();

  await db
    .update(carts)
    .set({ coupon: null })
    .where(eq(carts.owner, req.user._id));

  const newCart = await getCart(req.user._id);

  return res
    .status(200)
    .json(new ApiResponse(200, newCart, "Coupon removed successfully"));
});

const updateCouponActiveStatus = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { isActive } = req.body;
  const { couponId } = req.params;

  const [updatedCoupon] = await db
    .update(coupons)
    .set({ isActive })
    .where(eq(coupons.id, couponId))
    .returning();

  if (!updatedCoupon) {
    throw new ApiError(404, "Coupon does not exist");
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      withId(updatedCoupon),
      `Coupon is ${updatedCoupon?.isActive ? "active" : "inactive"}`
    )
  );
});

const getAllCoupons = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { page = 1, limit = 10 } = req.query;

  const result = await aggregatePaginate({
    page,
    limit,
    customLabels: {
      totalDocs: "totalCoupons",
      docs: "coupons",
    },
    getTotalDocs: async () => {
      const [row] = await db.select({ value: count() }).from(coupons);
      return Number(row?.value ?? 0);
    },
    getDocs: async ({ limit: take, offset }) => {
      const rows = await db.select().from(coupons).limit(take).offset(offset);
      return rows.map(withId);
    },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, result, "Coupons fetched successfully"));
});

const getValidCouponsForCustomer = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { page = 1, limit = 10 } = req.query;
  const now = new Date();

  const userCart = await getCart(req.user._id);
  const cartTotal = userCart.cartTotal;

  const validityFilter = and(
    lt(coupons.startDate, now),
    gt(coupons.expiryDate, now),
    eq(coupons.isActive, true),
    lte(coupons.minimumCartValue, cartTotal)
  );

  const result = await aggregatePaginate({
    page,
    limit,
    customLabels: {
      totalDocs: "totalCoupons",
      docs: "coupons",
    },
    getTotalDocs: async () => {
      const [row] = await db
        .select({ value: count() })
        .from(coupons)
        .where(validityFilter);
      return Number(row?.value ?? 0);
    },
    getDocs: async ({ limit: take, offset }) => {
      const rows = await db
        .select()
        .from(coupons)
        .where(validityFilter)
        .limit(take)
        .offset(offset);
      return rows.map(withId);
    },
  });

  return res
    .status(200)
    .json(
      new ApiResponse(200, result, "Customer coupons fetched successfully")
    );
});

const getCouponById = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { couponId } = req.params;

  const [coupon] = await db
    .select()
    .from(coupons)
    .where(eq(coupons.id, couponId))
    .limit(1);

  if (!coupon) {
    throw new ApiError(404, "Coupon does not exist");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, withId(coupon), "Coupon deleted successfully")
    );
});

const updateCoupon = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { couponId } = req.params;
  const {
    name,
    couponCode,
    type = CouponTypeEnum.FLAT,
    discountValue,
    minimumCartValue,
    startDate,
    expiryDate,
  } = req.body;

  const [couponToBeUpdated] = await db
    .select()
    .from(coupons)
    .where(eq(coupons.id, couponId))
    .limit(1);

  if (!couponToBeUpdated) {
    throw new ApiError(404, "Coupon does not exist");
  }

  const normalizedCode = couponCode?.trim().toUpperCase();

  if (normalizedCode) {
    const [duplicateCoupon] = await db
      .select()
      .from(coupons)
      .where(
        and(eq(coupons.couponCode, normalizedCode), ne(coupons.id, couponId))
      )
      .limit(1);

    if (duplicateCoupon) {
      throw new ApiError(
        409,
        "Coupon with code " + duplicateCoupon.couponCode + " already exists"
      );
    }
  }

  const _minimumCartValue =
    minimumCartValue ?? couponToBeUpdated.minimumCartValue;
  const _discountValue = discountValue ?? couponToBeUpdated.discountValue;

  if (_minimumCartValue && +_minimumCartValue < +_discountValue) {
    throw new ApiError(
      400,
      "Minimum cart value must be greater than or equal to the discount value"
    );
  }

  const [coupon] = await db
    .update(coupons)
    .set({
      name,
      ...(normalizedCode ? { couponCode: normalizedCode } : {}),
      type,
      discountValue: Number(_discountValue),
      minimumCartValue: Number(_minimumCartValue),
      ...(startDate != null ? { startDate: toDate(startDate) } : {}),
      ...(expiryDate != null ? { expiryDate: toDate(expiryDate) } : {}),
    })
    .where(eq(coupons.id, couponId))
    .returning();

  return res
    .status(200)
    .json(new ApiResponse(200, withId(coupon), "Coupon updated successfully"));
});

const deleteCoupon = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { couponId } = req.params;

  const [deletedCoupon] = await db
    .delete(coupons)
    .where(eq(coupons.id, couponId))
    .returning();

  if (!deletedCoupon) {
    throw new ApiError(404, "Coupon does not exist");
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      { deletedCoupon: withId(deletedCoupon) },
      "Coupon deleted successfully"
    )
  );
});

export {
  createCoupon,
  getAllCoupons,
  deleteCoupon,
  getCouponById,
  updateCoupon,
  applyCoupon,
  removeCouponFromCart,
  updateCouponActiveStatus,
  getValidCouponsForCustomer,
};
