import { filterObjectKeys, getPaginatedPayload } from "@/utils/helpers.js";
import { ApiError } from "@/utils/ApiError.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { asyncHandler } from "@/utils/asyncHandler.js";
import {
  getPayloadByDocId,
  getRandomPayload,
  listPayloads,
} from "@/utils/publicJsonDb.js";

const COLLECTION = "shipments";

const getShipments = asyncHandler(async (req, res) => {
  const page = +(req.query.page || 1);
  const limit = +(req.query.limit || 10);
  const query = req.query.query?.toLowerCase(); // search query
  const inc = req.query.inc?.split(","); // only include fields mentioned in this query

  const shipmentsJson = await listPayloads(COLLECTION);

  let shipmentsArray = query
    ? structuredClone(shipmentsJson).filter((shipment) => {
        return (
          shipment.trackingNumber?.toLowerCase().includes(query) ||
          shipment.orderNumber?.toLowerCase().includes(query) ||
          shipment.carrier?.toLowerCase().includes(query) ||
          shipment.status?.toLowerCase().includes(query)
        );
      })
    : structuredClone(shipmentsJson);

  const paginatedShipments = getPaginatedPayload(shipmentsArray, page, limit);
  const updatedShipments = inc
    ? filterObjectKeys(inc, paginatedShipments.data)
    : paginatedShipments.data;
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        ...paginatedShipments,
        data: updatedShipments,
      },
      "Shipments fetched successfully"
    )
  );
});

const getShipmentById = asyncHandler(async (req, res) => {
  const { shipmentId } = req.params;
  const shipment = await getPayloadByDocId(COLLECTION, shipmentId);
  if (!shipment) {
    throw new ApiError(404, "Shipment does not exist.");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, shipment, "Shipment fetched successfully"));
});

const getARandomShipment = asyncHandler(async (req, res) => {
  const shipment = await getRandomPayload(COLLECTION);
  if (!shipment) {
    throw new ApiError(404, "Shipment does not exist.");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, shipment, "Shipment fetched successfully"));
});

export { getShipments, getARandomShipment, getShipmentById };
