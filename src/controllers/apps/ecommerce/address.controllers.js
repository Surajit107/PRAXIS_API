import { and, count, eq } from "drizzle-orm";
import { dbInstance } from "@/db/index.js";
import { addresses } from "@/models/apps/ecommerce/address.models.js";
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

const createAddress = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { addressLine1, addressLine2, pincode, city, state, country } =
    req.body;
  const owner = req.user._id;

  const [address] = await db
    .insert(addresses)
    .values({
      addressLine1,
      addressLine2,
      city,
      country,
      owner,
      pincode,
      state,
    })
    .returning();

  return res
    .status(201)
    .json(new ApiResponse(200, withId(address), "Address created successfully"));
});

const getAllAddresses = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { page = 1, limit = 10 } = req.query;
  const ownerFilter = eq(addresses.owner, req.user._id);

  const result = await aggregatePaginate({
    page,
    limit,
    customLabels: {
      totalDocs: "totalAddresses",
      docs: "addresses",
    },
    getTotalDocs: async () => {
      const [row] = await db
        .select({ value: count() })
        .from(addresses)
        .where(ownerFilter);
      return Number(row?.value ?? 0);
    },
    getDocs: async ({ limit: take, offset }) => {
      const rows = await db
        .select()
        .from(addresses)
        .where(ownerFilter)
        .limit(take)
        .offset(offset);
      return rows.map(withId);
    },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, result, "Addresses fetched successfully"));
});

const getAddressById = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { addressId } = req.params;

  const [address] = await db
    .select()
    .from(addresses)
    .where(
      and(eq(addresses.id, addressId), eq(addresses.owner, req.user._id))
    )
    .limit(1);

  if (!address) {
    throw new ApiError(404, "Address does not exist");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, withId(address), "Address fetched successfully"));
});

const updateAddress = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { addressId } = req.params;
  const { addressLine1, addressLine2, pincode, city, state, country } =
    req.body;

  const [address] = await db
    .update(addresses)
    .set({
      addressLine1,
      addressLine2,
      city,
      country,
      pincode,
      state,
    })
    .where(
      and(eq(addresses.id, addressId), eq(addresses.owner, req.user._id))
    )
    .returning();

  if (!address) {
    throw new ApiError(404, "Address does not exist");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, withId(address), "Address updated successfully"));
});

const deleteAddress = asyncHandler(async (req, res) => {
  const db = requireDb();
  const { addressId } = req.params;

  const [address] = await db
    .delete(addresses)
    .where(
      and(eq(addresses.id, addressId), eq(addresses.owner, req.user._id))
    )
    .returning();

  if (!address) {
    throw new ApiError(404, "Address does not exist");
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      { deletedAddress: withId(address) },
      "Address deleted successfully"
    )
  );
});

export {
  createAddress,
  getAllAddresses,
  getAddressById,
  updateAddress,
  deleteAddress,
};
