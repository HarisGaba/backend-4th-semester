import mongoose from "mongoose";
import Booth from "../models/boothmodel.js";
import Event from "../models/eventmodel.js";
import Exhibitor from "../models/exhibitormodel.js";
import Notification from "../models/notificationmodel.js";

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

export async function assignBooth(req, res) {
  const { boothId, exhibitorId } = req.body || {};

  if (
    !mongoose.isObjectIdOrHexString(boothId) ||
    !mongoose.isObjectIdOrHexString(exhibitorId)
  ) {
    return res.status(400).json({
      msg: "Select a valid booth and exhibitor application",
    });
  }

  try {
    const assignedBooth = await mongoose.connection.transaction(
      async (session) => {
        const booth = await Booth.findById(boothId).session(session);

        if (!booth) {
          fail(404, "Booth not found");
        }

        const event = await Event.findById(booth.event)
          .session(session);

        if (!event) {
          fail(404, "Event not found");
        }

        const canManage =
          req.user.role === "admin" ||
          (req.user.role === "organizer" &&
            event.organizer.toString() === req.user._id.toString());

        if (!canManage) {
          fail(403, "You can only assign booths for your own events");
        }

        if (booth.status !== "Available" || booth.reservedBy) {
          fail(409, "This booth is already reserved");
        }

        const exhibitor = await Exhibitor.findOne({
          _id: exhibitorId,
          event: booth.event,
          status: "Approved",
        }).session(session);

        if (!exhibitor) {
          fail(
            400,
            "Select an approved exhibitor application for this event"
          );
        }

        const existingReservation = await Booth.exists({
          reservedBy: exhibitor._id,
        }).session(session);

        if (existingReservation || exhibitor.boothNumber) {
          fail(409, "This exhibitor already has a booth for this event");
        }

        const updated = await Booth.findOneAndUpdate(
          {
            _id: booth._id,
            status: "Available",
            reservedBy: null,
          },
          {
            $set: {
              status: "Reserved",
              reservedBy: exhibitor._id,
            },
          },
          {
            returnDocument: "after",
            runValidators: true,
            session,
          }
        );

        if (!updated) {
          fail(409, "Booth availability changed. Refresh the list");
        }

        exhibitor.boothNumber = updated.boothNumber;
        await exhibitor.save({ session });

        await Notification.create(
          [
            {
              recipient: exhibitor.contactPerson,
              message: `The organizer assigned booth ${updated.boothNumber} to "${exhibitor.companyName}" at "${event.title}". Open Booths to view your reservation.`,
            },
          ],
          { session }
        );

        return updated;
      }
    );

    return res.status(200).json({
      msg: "Booth assigned successfully",
      booth: assignedBooth,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        msg: "This exhibitor already has a reservation. Refresh the list",
      });
    }

    if (error.status) {
      return res.status(error.status).json({
        msg: error.message,
      });
    }

    console.error("Booth assignment failed:", error.name);

    return res.status(500).json({
      msg: "Unable to assign booth. Please try again",
    });
  }
}