import mongoose from "mongoose";
import Session from "../models/sessionmodel.js";
import Attendee from "../models/attendeemodel.js";
import Event from "../models/eventmodel.js";

function getActivity(session, userId) {
  const id = userId.toString();

  return {
    registered: session.registeredUsers.some(
      (user) => user.toString() === id
    ),
    bookmarked: session.bookmarkedBy.some(
      (user) => user.toString() === id
    ),
  };
}

async function getSessionActivity(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.isObjectIdOrHexString(id)) {
      return res.status(400).json({ msg: "Invalid session ID" });
    }

    const session = await Session.findById(id)
      .select("+registeredUsers +bookmarkedBy");

    if (!session) {
      return res.status(404).json({ msg: "Session not found" });
    }

    return res.status(200).json({
      activity: getActivity(session, req.user._id),
    });
  } catch {
    return res.status(500).json({
      msg: "Unable to load session activity",
    });
  }
}

async function updateSessionActivity(req, res) {
  try {
    const { id } = req.params;
    const { action, enabled } = req.body || {};

    if (!mongoose.isObjectIdOrHexString(id)) {
      return res.status(400).json({ msg: "Invalid session ID" });
    }

    if (
      !["register", "bookmark"].includes(action) ||
      typeof enabled !== "boolean"
    ) {
      return res.status(400).json({
        msg: "Invalid session action",
      });
    }

    const session = await Session.findById(id);

    if (!session) {
      return res.status(404).json({ msg: "Session not found" });
    }

    const event = await Event.exists({ _id: session.event });

    if (!event) {
      return res.status(404).json({ msg: "Event not found" });
    }

    const filter = { _id: id };

    if (action === "register" && enabled) {
      if (session.startTime.getTime() <= Date.now()) {
        return res.status(400).json({
          msg: "Registration is closed because this session has started",
        });
      }

      const registration = await Attendee.exists({
        user: req.user._id,
        event: session.event,
      });

      if (!registration) {
        return res.status(403).json({
          msg: "Register for this event through the Attendees page first",
        });
      }

      filter.startTime = { $gt: new Date() };
    }

    const field =
      action === "register" ? "registeredUsers" : "bookmarkedBy";

    const update = enabled
      ? { $addToSet: { [field]: req.user._id } }
      : { $pull: { [field]: req.user._id } };

    const updated = await Session.findOneAndUpdate(
      filter,
      update,
      { returnDocument: "after", runValidators: true }
    ).select("+registeredUsers +bookmarkedBy");

    if (!updated) {
      return res.status(409).json({
        msg: "The session changed or registration closed. Reload the schedule",
      });
    }

    let msg;

    if (action === "register") {
      msg = enabled
        ? "Registered for session successfully"
        : "Session registration cancelled";
    } else {
      msg = enabled
        ? "Session bookmarked"
        : "Bookmark removed";
    }

    return res.status(200).json({
      msg,
      activity: getActivity(updated, req.user._id),
    });
  } catch {
    return res.status(500).json({
      msg: "Unable to update session activity",
    });
  }
}

export { getSessionActivity, updateSessionActivity };