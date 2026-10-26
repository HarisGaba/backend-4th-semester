import mongoose from "mongoose";
import ServiceRequest from "../models/servicerequestmodel.js";
import Exhibitor from "../models/exhibitormodel.js";
import Event from "../models/eventmodel.js";
import Booth from "../models/boothmodel.js";
import Notification from "../models/notificationmodel.js";

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function sendError(res, error) {
  if (error.status) {
    return res.status(error.status).json({
      msg: error.message,
    });
  }

  console.error("Service request failed:", error.name);

  return res.status(500).json({
    msg: "Unable to process service request",
  });
}

async function getApplication(id, user, session = null) {
  if (!mongoose.isObjectIdOrHexString(id)) {
    fail(400, "Invalid application ID");
  }

  const application = await Exhibitor.findById(id)
    .session(session);

  if (!application) {
    fail(404, "Application not found");
  }

  const event = await Event.findById(application.event)
    .session(session);

  if (!event) {
    fail(404, "Event not found");
  }

  const owner =
    user.role === "exhibitor" &&
    application.contactPerson.toString() === user._id.toString();

  const manager =
    user.role === "admin" ||
    (user.role === "organizer" &&
      event.organizer.toString() === user._id.toString());

  if (!owner && !manager) {
    fail(403, "You do not have access to this application");
  }

  return { application, event, owner, manager };
}

export async function getServiceRequests(req, res) {
  try {
    const { application } = await getApplication(
      req.params.id,
      req.user
    );

    const requests = await ServiceRequest.find({
      exhibitor: application._id,
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(50)
      .lean();

    res.set("Cache-Control", "no-store");

    return res.status(200).json({ requests });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function createServiceRequest(req, res) {
  try {
    const { service, details } = req.body || {};
    const services = [
      "Electricity",
      "Internet",
      "Furniture",
      "Cleaning",
      "Other",
    ];

    if (
      !services.includes(service) ||
      typeof details !== "string" ||
      !details.trim() ||
      details.trim().length > 1000
    ) {
      fail(400, "Select a service and enter details up to 1000 characters");
    }

    const request = await mongoose.connection.transaction(
      async (session) => {
        const { application, event, owner } = await getApplication(
          req.params.id,
          req.user,
          session
        );

        if (!owner || application.status !== "Approved") {
          fail(403, "An approved application is required");
        }

        const booth = await Booth.exists({
          event: application.event,
          reservedBy: application._id,
          status: "Reserved",
        }).session(session);

        if (!booth) {
          fail(409, "Reserve a booth before requesting services");
        }

        const [created] = await ServiceRequest.create(
          [
            {
              exhibitor: application._id,
              event: application.event,
              service,
              details: details.trim(),
            },
          ],
          { session }
        );

        await Notification.create(
          [
            {
              recipient: event.organizer,
              message: `"${application.companyName}" submitted a ${service} request for "${event.title}". Open Exhibitors to review it.`,
            },
          ],
          { session }
        );

        return created;
      }
    );

    return res.status(201).json({
      msg: "Service request submitted",
      request,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function updateServiceRequest(req, res) {
  try {
    const { requestId } = req.params;
    const { status, reply = "" } = req.body || {};

    if (!mongoose.isObjectIdOrHexString(requestId)) {
      fail(400, "Invalid service request ID");
    }

    if (
      !["Approved", "Rejected", "Fulfilled"].includes(status) ||
      typeof reply !== "string" ||
      reply.trim().length > 1000
    ) {
      fail(400, "Provide a valid status and reply");
    }

    const updated = await mongoose.connection.transaction(
      async (session) => {
        const request = await ServiceRequest.findById(requestId)
          .session(session);

        if (!request) {
          fail(404, "Service request not found");
        }

        const { application, event, manager } = await getApplication(
          request.exhibitor,
          req.user,
          session
        );

        if (!manager) {
          fail(403, "Only the event organizer or admin can update requests");
        }

        if (request.event.toString() !== application.event.toString()) {
          fail(409, "Service request event does not match the application");
        }

        const previousStatus =
          status === "Fulfilled" ? "Approved" : "Pending";

        const changed = await ServiceRequest.findOneAndUpdate(
          {
            _id: request._id,
            status: previousStatus,
          },
          {
            $set: {
              status,
              reply: reply.trim(),
            },
          },
          {
            returnDocument: "after",
            runValidators: true,
            session,
          }
        );

        if (!changed) {
          fail(
            409,
            "Request status changed or this action is not allowed. Refresh the list"
          );
        }

        await Notification.create(
          [
            {
              recipient: application.contactPerson,
              message: `Your ${request.service} request for "${application.companyName}" at "${event.title}" is now ${status.toLowerCase()}. Open My Applications to view the details.`,
            },
          ],
          { session }
        );

        return changed;
      }
    );

    return res.status(200).json({
      msg: "Service request updated",
      request: updated,
    });
  } catch (error) {
    return sendError(res, error);
  }
}