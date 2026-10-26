import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    read: {
      type: Boolean,
      default: false,
    },
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
    },
    startTime: {
      type: Date,
    },
    reminderKey: {
      type: String,
      unique: true,
      sparse: true,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);