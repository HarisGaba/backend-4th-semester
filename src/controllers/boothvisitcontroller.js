import mongoose from "mongoose";
import BoothVisit from "../models/boothvisitmodel.js";
import Booth from "../models/boothmodel.js";
import Exhibitor from "../models/exhibitormodel.js";
import Attendee from "../models/attendeemodel.js";
import Event from "../models/eventmodel.js";

export async function getMyVisits(req, res) {
  try {
    const visits = await BoothVisit.find({
      attendee: req.user._id,
    })
      .select("exhibitor event booth createdAt -_id")
      .sort({ createdAt: -1 })
      .lean();

    res.set("Cache-Control", "no-store");

    return res.status(200).json({ visits });
  } catch {
    return res.status(500).json({
      msg: "Unable to load your booth visits",
    });
  }
}

export async function recordVisit(req, res) {
  const exhibitorId = req.body?.exhibitorId;

  if (!mongoose.isObjectIdOrHexString(exhibitorId)) {
    return res.status(400).json({
      msg: "Invalid exhibitor application ID",
    });
  }

  try {
    const exhibitor = await Exhibitor.findOne({
      _id: exhibitorId,
      status: "Approved",
    });

    if (!exhibitor) {
      return res.status(404).json({
        msg: "Approved exhibitor not found",
      });
    }

    const [event, registration, booth] = await Promise.all([
      Event.exists({ _id: exhibitor.event }),
      Attendee.exists({
        user: req.user._id,
        event: exhibitor.event,
      }),
      Booth.findOne({
        event: exhibitor.event,
        reservedBy: exhibitor._id,
        status: "Reserved",
      }).select("_id"),
    ]);

    if (!event) {
      return res.status(404).json({
        msg: "Event not found",
      });
    }

    if (!registration) {
      return res.status(403).json({
        msg: "Register for this event before recording a booth visit",
      });
    }

    if (!booth) {
      return res.status(409).json({
        msg: "This exhibitor does not currently have an assigned booth",
      });
    }

    await BoothVisit.init();

    await BoothVisit.updateOne(
      {
        attendee: req.user._id,
        exhibitor: exhibitor._id,
      },
      {
        $setOnInsert: {
          attendee: req.user._id,
          exhibitor: exhibitor._id,
          event: exhibitor.event,
          booth: booth._id,
        },
      },
      {
        upsert: true,
        runValidators: true,
      }
    );

    return res.status(200).json({
      msg: "Booth visit recorded",
      exhibitorId: exhibitor._id,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(200).json({
        msg: "This booth visit is already recorded",
        exhibitorId,
      });
    }

    console.error("Booth visit failed:", error.name);

    return res.status(500).json({
      msg: "Unable to record booth visit",
    });
  }
}