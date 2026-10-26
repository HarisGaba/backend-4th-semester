import mongoose from "mongoose";
import Exhibitor from "../models/exhibitormodel.js";
import Event from "../models/eventmodel.js";
import Notification from "../models/notificationmodel.js";

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

export async function updateApplicationStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body || {};

  if (!mongoose.isObjectIdOrHexString(id)) {
    return res.status(400).json({
      msg: "Invalid application ID",
    });
  }

  if (!["Approved", "Rejected"].includes(status)) {
    return res.status(400).json({
      msg: "Status must be Approved or Rejected",
    });
  }

  try {
    const updated = await mongoose.connection.transaction(
      async (session) => {
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

        const canManage =
          req.user.role === "admin" ||
          (req.user.role === "organizer" &&
            event.organizer.toString() === req.user._id.toString());

        if (!canManage) {
          fail(
            403,
            "You can only manage applications for your own events"
          );
        }

        const reviewed = await Exhibitor.findOneAndUpdate(
          {
            _id: application._id,
            status: "Pending",
          },
          {
            $set: { status },
          },
          {
            returnDocument: "after",
            runValidators: true,
            session,
          }
        );

        if (!reviewed) {
          fail(409, "This application has already been reviewed");
        }

        const message =
          status === "Approved"
            ? `Your application for "${application.companyName}" at "${event.title}" has been approved. You can now select an available booth.`
            : `Your application for "${application.companyName}" at "${event.title}" has been rejected. Contact the organizer through Feedback & Support if you need clarification.`;

        await Notification.create(
          [
            {
              recipient: application.contactPerson,
              message,
            },
          ],
          { session }
        );

        return reviewed;
      }
    );

    return res.status(200).json({
      msg: `Application ${status.toLowerCase()} successfully`,
      updated,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        msg: error.message,
      });
    }

    console.error("Application review failed:", error.name);

    return res.status(500).json({
      msg: "Unable to review application. Please try again",
    });
  }
}