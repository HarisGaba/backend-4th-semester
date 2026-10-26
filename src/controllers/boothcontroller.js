import mongoose from "mongoose";
import Booth from "../models/boothmodel.js";
import Event from "../models/eventmodel.js";
import Exhibitor from "../models/exhibitormodel.js";

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

async function createBooth(req, res) {
  try {
    const { event, boothNumber } = req.body || {};

    if (!mongoose.isObjectIdOrHexString(event)) {
      return res.status(400).json({ msg: "Select a valid event" });
    }

    if (
      typeof boothNumber !== "string" ||
      !boothNumber.trim() ||
      boothNumber.trim().length > 20
    ) {
      return res.status(400).json({
        msg: "Enter a booth number with at most 20 characters",
      });
    }

    const selectedEvent = await Event.findById(event);

    if (!selectedEvent) {
      return res.status(404).json({ msg: "Event not found" });
    }

    if (
      req.user.role !== "admin" &&
      selectedEvent.organizer.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        msg: "You can only create booths for your own events",
      });
    }

    const booth = await Booth.create({
      event,
      boothNumber: boothNumber.trim().toUpperCase(),
    });

    return res.status(201).json({
      msg: "Booth created successfully",
      booth,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        msg: "This booth number already exists for the event",
      });
    }

    return res.status(500).json({ msg: "Unable to create booth" });
  }
}

async function getEventBooths(req, res) {
  try {
    const { eventId } = req.params;

    if (!mongoose.isObjectIdOrHexString(eventId)) {
      return res.status(400).json({ msg: "Invalid event ID" });
    }

    const event = await Event.exists({ _id: eventId });

    if (!event) {
      return res.status(404).json({ msg: "Event not found" });
    }

    const booths = await Booth.find({ event: eventId })
      .populate("reservedBy", "companyName")
      .sort({ boothNumber: 1 });

    return res.status(200).json({ booths });
  } catch {
    return res.status(500).json({ msg: "Unable to load booths" });
  }
}

async function reserveBooth(req, res) {
  try {
    const { boothId } = req.body || {};

    if (!mongoose.isObjectIdOrHexString(boothId)) {
      return res.status(400).json({ msg: "Invalid booth ID" });
    }

    const reservedBooth = await mongoose.connection.transaction(
      async (session) => {
        const booth = await Booth.findById(boothId).session(session);

        if (!booth) {
          fail(404, "Booth not found");
        }

        const event = await Event.findById(booth.event).session(session);

        if (!event) {
          fail(404, "Event not found");
        }

        const exhibitor = await Exhibitor.findOne({
          contactPerson: req.user._id,
          event: booth.event,
          status: "Approved",
        }).session(session);

        if (!exhibitor) {
          fail(403, "Your application must be approved for this event");
        }

        const existing = await Booth.exists({
          reservedBy: exhibitor._id,
        }).session(session);

        if (existing || exhibitor.boothNumber) {
          fail(409, "You already have a booth for this event");
        }

        const updated = await Booth.findOneAndUpdate(
          {
            _id: boothId,
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
          fail(409, "This booth is already reserved");
        }

        exhibitor.boothNumber = updated.boothNumber;
        await exhibitor.save({ session });

        return updated;
      }
    );

    return res.status(200).json({
      msg: "Booth reserved successfully",
      booth: reservedBooth,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        msg: "A reservation already exists. Refresh the booth list",
      });
    }

    if (error.status) {
      return res.status(error.status).json({ msg: error.message });
    }

    console.error("Booth reservation failed:", error.message);

    return res.status(500).json({
      msg: "Unable to reserve booth. Please try again",
    });
  }
}

export { createBooth, getEventBooths, reserveBooth };