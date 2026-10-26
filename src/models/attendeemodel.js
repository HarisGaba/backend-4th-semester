import mongoose from "mongoose";

const attendeeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    ticketType: {
      type: String,
      enum: ["Standard", "VIP", "Regular"],
      default: "Standard",
    },
  },
  { timestamps: true }
);

attendeeSchema.index(
  { user: 1, event: 1 },
  { unique: true }
);

export default mongoose.model("Attendee", attendeeSchema);