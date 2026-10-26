import mongoose from "mongoose";
import Notification from "../models/notificationmodel.js";

async function getNotifications(req, res) {
  try {
    const filter = { recipient: req.user._id };

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Notification.countDocuments({
      ...filter,
      read: false,
    });

    return res.status(200).json({
      notifications,
      unreadCount,
    });
  } catch {
    return res.status(500).json({
      msg: "Unable to load notifications",
    });
  }
}

async function markAsRead(req, res) {
  try {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) {
      return res.status(400).json({
        msg: "Invalid notification ID",
      });
    }

    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        recipient: req.user._id,
      },
      { $set: { read: true } },
      { returnDocument: "after" }
    );

    if (!notification) {
      return res.status(404).json({
        msg: "Notification not found",
      });
    }

    return res.status(200).json({
      msg: "Notification marked as read",
    });
  } catch {
    return res.status(500).json({
      msg: "Unable to update notification",
    });
  }
}

async function markAllAsRead(req, res) {
  try {
    await Notification.updateMany(
      {
        recipient: req.user._id,
        read: false,
      },
      { $set: { read: true } }
    );

    return res.status(200).json({
      msg: "All notifications marked as read",
    });
  } catch {
    return res.status(500).json({
      msg: "Unable to update notifications",
    });
  }
}

export {
  getNotifications,
  markAsRead,
  markAllAsRead,
};