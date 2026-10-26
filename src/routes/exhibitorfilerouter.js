import express from "express";
import multer from "multer";
import { rateLimit } from "express-rate-limit";
import { authenticate } from "../middleware/authmiddleware.js";
import {
  loadExhibitor,
  canUpload,
  canReadFiles,
  uploadFile,
  getFiles,
  getPublicLogo,
  getPrivateLogo,
  downloadDocument,
} from "../controllers/exhibitorfilecontroller.js";

const exhibitorFileRouter = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
    fields: 0,
    parts: 2,
  },
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    msg: "Too many uploads. Please try again later",
  },
});

exhibitorFileRouter.param("id", loadExhibitor);

exhibitorFileRouter.get("/:id/logo", getPublicLogo);

exhibitorFileRouter.use(authenticate);

exhibitorFileRouter.get("/:id", canReadFiles, getFiles);

exhibitorFileRouter.get(
  "/:id/private-logo",
  canReadFiles,
  getPrivateLogo
);

exhibitorFileRouter.get(
  "/:id/document",
  canReadFiles,
  downloadDocument
);

exhibitorFileRouter.post(
  "/:id/:kind",
  canUpload,
  uploadLimiter,
  upload.single("file"),
  uploadFile
);

exhibitorFileRouter.use((error, req, res, next) => {
  if (!(error instanceof multer.MulterError)) {
    return next(error);
  }

  return res.status(
    error.code === "LIMIT_FILE_SIZE" ? 413 : 400
  ).json({
    msg:
      error.code === "LIMIT_FILE_SIZE"
        ? "File must be 5 MB or smaller"
        : "Upload one file using the file field",
  });
});

export default exhibitorFileRouter; 