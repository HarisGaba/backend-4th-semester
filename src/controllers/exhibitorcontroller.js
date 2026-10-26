import mongoose from "mongoose";
import Exhibitor from "../models/exhibitormodel.js";
import Event from "../models/eventmodel.js";

async function registerExhibitor(req, res) {
  try {
    const { companyName, category, description, event } = req.body || {};

    if (
      typeof companyName !== "string" ||
      !companyName.trim() ||
      companyName.trim().length > 150 ||
      typeof category !== "string" ||
      !category.trim() ||
      category.trim().length > 100 ||
      typeof description !== "string" ||
      !description.trim() ||
      description.trim().length > 2000
    ) {
      return res.status(400).json({
        msg: "Enter valid company details, category and description",
      });
    }

    if (!mongoose.isObjectIdOrHexString(event)) {
      return res.status(400).json({ msg: "Select a valid event" });
    }

    const selectedEvent = await Event.findById(event);

    if (!selectedEvent) {
      return res.status(404).json({ msg: "Event not found" });
    }

    const existing = await Exhibitor.exists({
      contactPerson: req.user._id,
      event,
    });

    if (existing) {
      return res.status(409).json({
        msg: "You have already applied for this event",
      });
    }

    const exhibitor = await Exhibitor.create({
      companyName: companyName.trim(),
      category: category.trim(),
      description: description.trim(),
      event,
      contactPerson: req.user._id,
    });

    return res.status(201).json({
      msg: "Application submitted successfully",
      exhibitor,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        msg: "You have already applied for this event",
      });
    }

    return res.status(500).json({
      msg: "Unable to submit application",
    });
  }
}

async function getExhibitors(req, res) {
  try {
    let filter = {};

    if (req.user.role === "organizer") {
      const events = await Event.find({
        organizer: req.user._id,
      }).select("_id");

      filter.event = { $in: events.map((event) => event._id) };
    } else if (req.user.role === "exhibitor") {
      filter.contactPerson = req.user._id;
    }

    const exhibitors = await Exhibitor.find(filter)
      .populate("contactPerson", "name email")
      .populate("event", "title")
      .sort({ createdAt: -1 });

    return res.status(200).json({ exhibitors });
  } catch {
    return res.status(500).json({
      msg: "Unable to load applications",
    });
  }
}

export { registerExhibitor, getExhibitors };
