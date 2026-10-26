import mongoose from "mongoose";

const exhibitorFileSchema = new mongoose.Schema(
  {
    exhibitor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exhibitor",
      required: true,
    },
    kind: {
      type: String,
      enum: ["logo", "document"],
      required: true,
    },
    filename: {
      type: String,
      required: true,
    },
    contentType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    data: {
      type: Buffer,
      required: true,
      select: false,
    },
  },
  { timestamps: true }
);

exhibitorFileSchema.index(
  { exhibitor: 1, kind: 1 },
  { unique: true }
);

export default mongoose.model("ExhibitorFile", exhibitorFileSchema);