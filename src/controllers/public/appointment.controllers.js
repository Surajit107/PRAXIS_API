import { filterObjectKeys, getPaginatedPayload } from "@/utils/helpers.js";
import { ApiError } from "@/utils/ApiError.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { asyncHandler } from "@/utils/asyncHandler.js";
import {
  getPayloadByDocId,
  getRandomPayload,
  listPayloads,
} from "@/utils/publicJsonDb.js";

const COLLECTION = "appointments";

const getAppointments = asyncHandler(async (req, res) => {
  const page = +(req.query.page || 1);
  const limit = +(req.query.limit || 10);
  const query = req.query.query?.toLowerCase(); // search query
  const inc = req.query.inc?.split(","); // only include fields mentioned in this query

  const appointmentsJson = await listPayloads(COLLECTION);

  let appointmentsArray = query
    ? structuredClone(appointmentsJson).filter((appointment) => {
        return (
          appointment.title?.toLowerCase().includes(query) ||
          appointment.status?.toLowerCase().includes(query) ||
          appointment.customer?.name?.toLowerCase().includes(query) ||
          appointment.host?.name?.toLowerCase().includes(query)
        );
      })
    : structuredClone(appointmentsJson);

  const paginatedAppointments = getPaginatedPayload(appointmentsArray, page, limit);
  const updatedAppointments = inc
    ? filterObjectKeys(inc, paginatedAppointments.data)
    : paginatedAppointments.data;
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        ...paginatedAppointments,
        data: updatedAppointments,
      },
      "Appointments fetched successfully"
    )
  );
});

const getAppointmentById = asyncHandler(async (req, res) => {
  const { appointmentId } = req.params;
  const appointment = await getPayloadByDocId(COLLECTION, appointmentId);
  if (!appointment) {
    throw new ApiError(404, "Appointment does not exist.");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, appointment, "Appointment fetched successfully"));
});

const getARandomAppointment = asyncHandler(async (req, res) => {
  const appointment = await getRandomPayload(COLLECTION);
  if (!appointment) {
    throw new ApiError(404, "Appointment does not exist.");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, appointment, "Appointment fetched successfully"));
});

export { getAppointments, getARandomAppointment, getAppointmentById };
