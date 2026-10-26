import mongoose from "mongoose";
import Booth from "../models/boothmodel.js";
import Exhibitor from "../models/exhibitormodel.js";

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

export async function cancelBoothReservation(req, res) {
  const { boothId } = req.body || {};

  if (!mongoose.isObjectIdOrHexString(boothId)) {
    return res.status(400).json({
      msg: "Invalid booth ID",
    });
  }

  try {
    const cancelledBooth = await mongoose.connection.transaction(
      async (session) => {
        const booth = await Booth.findById(boothId).session(session);

        if (!booth) {
          fail(404, "Booth not found");
        }

        if (booth.status !== "Reserved" || !booth.reservedBy) {
          fail(409, "This booth has no active reservation");
        }

        const exhibitor = await Exhibitor.findOne({
          _id: booth.reservedBy,
          contactPerson: req.user._id,
          event: booth.event,
        }).session(session);

        if (!exhibitor) {
          fail(403, "You can only cancel your own reservation");
        }

        const updated = await Booth.findOneAndUpdate(
          {
            _id: booth._id,
            status: "Reserved",
            reservedBy: exhibitor._id,
          },
          {
            $set: {
              status: "Available",
              reservedBy: null,
            },
          },
          {
            returnDocument: "after",
            runValidators: true,
            session,
          }
        );

        if (!updated) {
          fail(409, "Reservation changed. Refresh the booth list");
        }

        exhibitor.boothNumber = "";
        await exhibitor.save({ session });

        return updated;
      }
    );

    return res.status(200).json({
      msg: "Booth reservation cancelled successfully",
      booth: cancelledBooth,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        msg: error.message,
      });
    }

    console.error("Booth cancellation failed:", error.name);

    return res.status(500).json({
      msg: "Unable to cancel reservation. Please try again",
    });
  }
}