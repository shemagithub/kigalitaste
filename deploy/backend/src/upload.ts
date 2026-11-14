import multer from "multer";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { uploadsDir } from "./db.ts";

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".bin";
    cb(null, `${randomUUID()}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const mime = String(file.mimetype || "").toLowerCase();
    const ext = path.extname(file.originalname || "").toLowerCase();
    const okMime = /^(image\/(jpeg|jpg|pjpeg|png|webp|gif|avif|heic|heif|bmp)|application\/pdf)$/.test(mime);
    const okExt = /^\.(jpe?g|png|webp|gif|avif|heic|heif|bmp|pdf)$/.test(ext);
    if (!okMime && !okExt) {
      cb(new Error("Please upload a JPEG, PNG, WebP, GIF, or PDF"));
      return;
    }
    cb(null, true);
  },
});

export function fileUrl(filename?: string) {
  return filename ? `/uploads/${filename}` : "";
}

/** Turn broken values like https://uploads/file.jpg into /uploads/file.jpg */
export function publicFilePath(raw?: string | null) {
  const value = String(raw || "").trim();
  if (!value) return "";
  const hostMatch = value.match(/^https?:\/\/uploads\/+([^/?#]+)/i);
  if (hostMatch) return `/uploads/${hostMatch[1]}`;
  const pathMatch = value.match(/(?:^|\/)uploads\/([^/?#]+)/i);
  if (pathMatch) return `/uploads/${pathMatch[1]}`;
  if (/^[\w.-]+\.(jpe?g|png|webp|gif|svg|pdf)$/i.test(value)) return `/uploads/${value}`;
  return value;
}

/** Mailbox compose attachments — broader types than menu uploads */
export const mailUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    const ok =
      /^(image\/(jpeg|png|webp|gif)|application\/(pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document|vnd\.ms-excel|vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet)|text\/(plain|csv))/.test(
        file.mimetype,
      ) || file.originalname.match(/\.(pdf|doc|docx|xls|xlsx|csv|txt|jpg|jpeg|png|gif|webp)$/i);
    if (!ok) {
      cb(new Error("Unsupported attachment type"));
      return;
    }
    cb(null, true);
  },
});
