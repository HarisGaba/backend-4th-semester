import mongoose from "mongoose";
import Event from "../models/eventmodel.js";
import Exhibitor from "../models/exhibitormodel.js";
import Attendee from "../models/attendeemodel.js";
import Booth from "../models/boothmodel.js";
import Session from "../models/sessionmodel.js";

function readEvent(body = {}) {
  const fields = ["title", "description", "location", "category"];
  const data = {};

  for (const field of fields) {
    if (typeof body[field] !== "string" || !body[field].trim()) {
      return { error: "Please fill all fields" };
    }

    data[field] = body[field].trim();
  }

  if (
    data.title.length > 150 ||
    data.description.length > 5000 ||
    data.location.length > 200 ||
    data.category.length > 100
  ) {
    return { error: "One or more fields are too long" };
  }

  if (typeof body.date !== "string" || !body.date.trim()) {
    return { error: "Please enter an event date" };
  }

  const date = new Date(body.date);

  if (Number.isNaN(date.getTime())) {
    return { error: "Please enter a valid date" };
  }

  data.date = date;

  return { data };
}

function canManage(user, event) {
  return (
    user.role === "admin" ||
    event.organizer.toString() === user._id.toString()
  );
}

async function createEvent(req, res) {
  try {
    const result = readEvent(req.body);

    if (result.error) {
      return res.status(400).json({ msg: result.error });
    }

    const event = await Event.create({
      ...result.data,
      organizer: req.user._id,
    });

    return res.status(201).json({
      msg: "Event created successfully",
      event,
    });
  } catch {
    return res.status(500).json({
      msg: "Unable to create event",
    });
  }
}

async function getEvents(req, res) {
  try {
    const events = await Event.find()
      .populate("organizer", "name")
      .sort({ date: 1 });

    return res.status(200).json({ events });
  } catch {
    return res.status(500).json({
      msg: "Unable to load events",
    });
  }
}

async function getEvent(req, res) {
  try {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) {
      return res.status(400).json({ msg: "Invalid event ID" });
    }

    const event = await Event.findById(req.params.id).populate(
      "organizer",
      "name"
    );

    if (!event) {
      return res.status(404).json({ msg: "Event not found" });
    }

    return res.status(200).json({ event });
  } catch {
    return res.status(500).json({
      msg: "Unable to load event",
    });
  }
}

async function updateEvent(req, res) {
  try {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) {
      return res.status(400).json({ msg: "Invalid event ID" });
    }

    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ msg: "Event not found" });
    }

    if (!canManage(req.user, event)) {
      return res.status(403).json({
        msg: "You can only edit your own events",
      });
    }

    const result = readEvent(req.body);

    if (result.error) {
      return res.status(400).json({ msg: result.error });
    }

    Object.assign(event, result.data);
    await event.save();

    return res.status(200).json({
      msg: "Event updated successfully",
      event,
    });
  } catch {
    return res.status(500).json({
      msg: "Unable to update event",
    });
  }
}

async function deleteEvent(req, res) {
  try {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) {
      return res.status(400).json({ msg: "Invalid event ID" });
    }

    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ msg: "Event not found" });
    }

    if (!canManage(req.user, event)) {
      return res.status(403).json({
        msg: "You can only delete your own events",
      });
    }

    const relatedRecords = await Promise.all([
      Exhibitor.exists({ event: event._id }),
      Attendee.exists({ event: event._id }),
      Booth.exists({ event: event._id }),
      Session.exists({ event: event._id }),
    ]);

    if (relatedRecords.some(Boolean)) {
      return res.status(409).json({
        msg: "This event has registrations, booths or sessions. Remove those records before deleting it",
      });
    }

    await event.deleteOne();

    return res.status(200).json({
      msg: "Event deleted successfully",
    });
  } catch {
    return res.status(500).json({
      msg: "Unable to delete event",
    });
  }
}

export { createEvent,getEvents,getEvent,updateEvent,deleteEvent, };