import { filterObjectKeys, getPaginatedPayload } from "@/utils/helpers.js";
import { ApiError } from "@/utils/ApiError.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { asyncHandler } from "@/utils/asyncHandler.js";
import {
  getPayloadByDocId,
  getRandomPayload,
  listPayloads,
} from "@/utils/publicJsonDb.js";

const COLLECTION = "tickets";

const getTickets = asyncHandler(async (req, res) => {
  const page = +(req.query.page || 1);
  const limit = +(req.query.limit || 10);
  const query = req.query.query?.toLowerCase(); // search query
  const inc = req.query.inc?.split(","); // only include fields mentioned in this query

  const ticketsJson = await listPayloads(COLLECTION);

  let ticketsArray = query
    ? structuredClone(ticketsJson).filter((ticket) => {
        return (
          ticket.subject?.toLowerCase().includes(query) ||
          ticket.description?.toLowerCase().includes(query) ||
          ticket.status?.toLowerCase().includes(query) ||
          ticket.priority?.toLowerCase().includes(query) ||
          ticket.requester?.email?.toLowerCase().includes(query)
        );
      })
    : structuredClone(ticketsJson);

  const paginatedTickets = getPaginatedPayload(ticketsArray, page, limit);
  const updatedTickets = inc
    ? filterObjectKeys(inc, paginatedTickets.data)
    : paginatedTickets.data;
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        ...paginatedTickets,
        data: updatedTickets,
      },
      "Tickets fetched successfully"
    )
  );
});

const getTicketById = asyncHandler(async (req, res) => {
  const { ticketId } = req.params;
  const ticket = await getPayloadByDocId(COLLECTION, ticketId);
  if (!ticket) {
    throw new ApiError(404, "Ticket does not exist.");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, ticket, "Ticket fetched successfully"));
});

const getARandomTicket = asyncHandler(async (req, res) => {
  const ticket = await getRandomPayload(COLLECTION);
  if (!ticket) {
    throw new ApiError(404, "Ticket does not exist.");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, ticket, "Ticket fetched successfully"));
});

export { getTickets, getARandomTicket, getTicketById };
