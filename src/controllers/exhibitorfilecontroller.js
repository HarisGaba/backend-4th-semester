import mongoose from "mongoose";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import Exhibitor from "../models/exhibitormodel.js";
import ExhibitorFile from "../models/exhibitorfilemodel.js";

function sendError(res, error) {
  console.error("Exhibitor file request failed:", error.name);

  return res.status(500).json({
    msg: "Unable to process the file request",
  });
}

async function loadExhibitor(req, res, next, id) {
  try {
    if (!mongoose.isObjectIdOrHexString(id)) {
      return res.status(400).json({ msg: "Invalid application ID" });
    }

    const exhibitor = await Exhibitor.findById(id)
      .populate("event", "organizer");

    if (!exhibitor) {
      return res.status(404).json({ msg: "Application not found" });
    }

    req.exhibitor = exhibitor;
    next();
  } catch (error) {
    return sendError(res, error);
  }
}

function canUpload(req, res, next) {
  const ownerId = req.exhibitor.contactPerson.toString();

  if (
    req.user.role !== "exhibitor" ||
    ownerId !== req.user._id.toString()
  ) {
    return res.status(403).json({
      msg: "You can only upload files for your own application",
    });
  }

  if (!["logo", "document"].includes(req.params.kind)) {
    return res.status(400).json({ msg: "Invalid upload type" });
  }

  next();
}

function canReadFiles(req, res, next) {
  const userId = req.user._id.toString();
  const isOwner =
    req.exhibitor.contactPerson.toString() === userId;

  const isOrganizer =
    req.user.role === "organizer" &&
    req.exhibitor.event?.organizer?.toString() === userId;

  if (!isOwner && !isOrganizer && req.user.role !== "admin") {
    return res.status(403).json({
      msg: "You do not have access to these files",
    });
  }

  next();
}

async function uploadFile(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ msg: "Select a file to upload" });
    }

    const { kind } = req.params;
    let data;
    let filename;
    let contentType;

    if (kind === "logo") {
      if (req.file.size > 2 * 1024 * 1024) {
        return res.status(400).json({
          msg: "Logo must be 2 MB or smaller",
        });
      }

      try {
        const image = sharp(req.file.buffer, {
          limitInputPixels: 10000000,
        });

        const metadata = await image.metadata();

        if (
          !["jpeg", "png"].includes(metadata.format) ||
          (metadata.pages && metadata.pages > 1)
        ) {
          return res.status(400).json({
            msg: "Select a non-animated JPG or PNG logo",
          });
        }

        data = await image
          .rotate()
          .resize(400, 400, {
            fit: "inside",
            withoutEnlargement: true,
          })
          .png()
          .toBuffer();
      } catch {
        return res.status(400).json({
          msg: "Unable to read this image. Select a valid JPG or PNG",
        });
      }

      filename = "company-logo.png";
      contentType = "image/png";
    } else {
      try {
        if (
          req.file.buffer.subarray(0, 5).toString() !== "%PDF-"
        ) {
          return res.status(400).json({
            msg: "Select a PDF document",
          });
        }

        const pdf = await PDFDocument.load(req.file.buffer);

        if (pdf.getPageCount() === 0) {
          return res.status(400).json({
            msg: "The PDF must contain at least one page",
          });
        }
      } catch {
        return res.status(400).json({
          msg: "Select a readable PDF without password protection",
        });
      }

      data = req.file.buffer;
      filename = "application-document.pdf";
      contentType = "application/pdf";
    }

    await ExhibitorFile.findOneAndUpdate(
      {
        exhibitor: req.exhibitor._id,
        kind,
      },
      {
        $set: {
          filename,
          contentType,
          size: data.length,
          data,
        },
      },
      {
        upsert: true,
        returnDocument: "after",
        runValidators: true,
      }
    );

    return res.status(200).json({
      msg: `${kind === "logo" ? "Logo" : "Document"} uploaded successfully`,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        msg: "Another upload was saved. Refresh and try again",
      });
    }

    return sendError(res, error);
  }
}

async function getFiles(req, res) {
  try {
    const files = await ExhibitorFile.find({
      exhibitor: req.exhibitor._id,
    })
      .select("kind filename contentType size updatedAt")
      .sort({ kind: 1 });

    res.set("Cache-Control", "no-store");

    return res.status(200).json({ files });
  } catch (error) {
    return sendError(res, error);
  }
}

async function sendFile(req, res, kind, download) {
  try {
    const file = await ExhibitorFile.findOne({
      exhibitor: req.exhibitor._id,
      kind,
    }).select("+data");

    if (!file) {
      return res.status(404).json({
        msg: `${kind === "logo" ? "Logo" : "Document"} not uploaded`,
      });
    }

    res.set({
      "Content-Type": file.contentType,
      "Content-Disposition":
        `${download ? "attachment" : "inline"}; filename="${file.filename}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    });

    return res.send(Buffer.from(file.data));
  } catch (error) {
    return sendError(res, error);
  }
}

async function getPublicLogo(req, res) {
  if (req.exhibitor.status !== "Approved") {
    return res.status(404).json({ msg: "Logo not available" });
  }

  return sendFile(req, res, "logo", false);
}

async function getPrivateLogo(req, res) {
  return sendFile(req, res, "logo", false);
}

async function downloadDocument(req, res) {
  return sendFile(req, res, "document", true);
}

export {
  loadExhibitor,
  canUpload,
  canReadFiles,
  uploadFile,
  getFiles,
  getPublicLogo,
  getPrivateLogo,
  downloadDocument,
};