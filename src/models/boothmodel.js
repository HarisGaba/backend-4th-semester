import mongoose from "mongoose";

const boothSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    boothNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 20,
    },
    status: {
      type: String,
      enum: ["Available", "Reserved"],
      default: "Available",
    },
    reservedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exhibitor",
      default: null,
    },
  },
  { timestamps: true }
);

boothSchema.index(
  { event: 1, boothNumber: 1 },
  { unique: true }
);

boothSchema.index(
  { reservedBy: 1 },
  {
    unique: true,
    partialFilterExpression: {
      reservedBy: { $type: "objectId" },
    },
  }
);

export default mongoose.model("Booth", boothSchema);