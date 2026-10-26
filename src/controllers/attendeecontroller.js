import mongoose from "mongoose";
import Attendee from "../models/attendeemodel.js";
import Event from "../models/eventmodel.js";

async function registerAttendee(req, res) {
  try {
    const { event, ticketType = "Standard" } = req.body || {};

    if (!mongoose.isObjectIdOrHexString(event)) {
      return res.status(400).json({
        msg: "Select a valid event",
      });
    }

    if (!["Standard", "VIP", "Regular"].includes(ticketType)) {
      return res.status(400).json({
        msg: "Select a valid ticket type",
      });
    }

    const selectedEvent = await Event.findById(event);

    if (!selectedEvent) {
      return res.status(404).json({ msg: "Event not found" });
    }

    await Attendee.init();

    const existing = await Attendee.exists({
      user: req.user._id,
      event,
    });

    if (existing) {
      return res.status(409).json({
        msg: "You are already registered for this event",
      });
    }

    const registration = await Attendee.create({
      user: req.user._id,
      event,
      ticketType,
    });

    return res.status(201).json({
      msg: "Registered for event successfully",
      registration,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        msg: "You are already registered for this event",
      });
    }

    console.error("Attendee registration failed:", error.message);

    return res.status(500).json({
      msg: "Unable to register for event",
    });
  }
}

async function getAttendees(req, res) {
  try {
    let filter = {};

    if (req.user.role === "attendee") {
      filter.user = req.user._id;
    } else if (req.user.role === "organizer") {
      const events = await Event.find({
        organizer: req.user._id,
      }).select("_id");

      filter.event = {
        $in: events.map((event) => event._id),
      };
    } else if (req.user.role !== "admin") {
      return res.status(403).json({
        msg: "You do not have access to attendee registrations",
      });
    }

    const attendees = await Attendee.find(filter)
      .populate("user", "name email")
      .populate("event", "title date location")
      .sort({ createdAt: -1 });

    return res.status(200).json({ attendees });
  } catch {
    return res.status(500).json({
      msg: "Unable to load registrations",
    });
  }
}

export { registerAttendee, getAttendees };