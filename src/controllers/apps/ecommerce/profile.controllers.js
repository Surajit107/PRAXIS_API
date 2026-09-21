import { count, eq } from "drizzle-orm";
import { dbInstance } from "@/db/index.js";
import { hydrateOrder } from "@/controllers/apps/ecommerce/order.controllers.js";
import { ecomOrders } from "@/models/apps/ecommerce/order.models.js";
import { ecomProfiles } from "@/models/apps/ecommerce/profile.models.js";
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

const getMyEcomProfile = asyncHandler(async (req, res) => {
  const db = requireDb();

  const [profile] = await db
    .select()
    .from(ecomProfiles)
    .where(eq(ecomProfiles.owner, req.user._id))
    .limit(1);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        withId(profile),
        "User profile fetched successfully"
      )
    );
});

const updateEcomProfile = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { firstName, lastName, phoneNumber, countryCode } = req.body;

  const [profile] = await db
    .update(ecomProfiles)
    .set({
      firstName,
      lastName,
      phoneNumber,
      countryCode,
    })
    .where(eq(ecomProfiles.owner, req.user._id))
    .returning();

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        withId(profile),
        "User profile updated successfully"
      )
    );
});

const getMyOrders = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { page = 1, limit = 10 } = req.query;
  const customerFilter = eq(ecomOrders.customer, req.user._id);

  const result = await aggregatePaginate({
    page,
    limit,
    customLabels: {
      totalDocs: "totalOrders",
      docs: "orders",
    },
    getTotalDocs: async () => {
      const [row] = await db
        .select({ value: count() })
        .from(ecomOrders)
        .where(customerFilter);
      return Number(row?.value ?? 0);
    },
    getDocs: async ({ limit: take, offset }) => {
      const rows = await db
        .select()
        .from(ecomOrders)
        .where(customerFilter)
        .limit(take)
        .offset(offset);

      return Promise.all(
        rows.map((row) => hydrateOrder(db, row, { includeItems: false }))
      );
    },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, result, "Orders fetched successfully"));
});

export { getMyEcomProfile, updateEcomProfile, getMyOrders };
