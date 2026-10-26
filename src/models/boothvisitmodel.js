import mongoose from "mongoose";

const boothVisitSchema = new mongoose.Schema(
  {
    attendee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    exhibitor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exhibitor",
      required: true,
    },
    booth: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booth",
      required: true,
    },
  },
  { timestamps: true }
);

boothVisitSchema.index(
  { attendee: 1, exhibitor: 1 },
  { unique: true }
);

boothVisitSchema.index({ event: 1, exhibitor: 1 });

export default mongoose.model("BoothVisit", boothVisitSchema);