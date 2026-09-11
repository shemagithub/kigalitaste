import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Attachment } from "mailparser";
import { many, one, run, now, uploadsDir } from "./db.ts";

export const mailboxAttachmentsDir = path.join(uploadsDir, "mailbox");
mkdirSync(mailboxAttachmentsDir, { recursive: true });

export type MailboxAttachmentRow = {
  id: number;
  messageId: number;
  filename: string;
  storedName: string;
  mimeType: string;
  size: number;
  createdAt: string;
};

function safeFilename(name: string) {
  const base = path.basename(String(name || "attachment").replace(/[^\w.\-()+\s]/g, "_")).trim();
  return base || "attachment";
}

function storedFileName(original: string) {
  const ext = path.extname(original).toLowerCase().slice(0, 12);
  return `${randomUUID()}${ext || ".bin"}`;
}

export async function saveMailboxAttachment(
  messageId: number,
  filename: string,
  content: Buffer,
  mimeType: string,
) {
  const cleanName = safeFilename(filename);
  const storedName = storedFileName(cleanName);
  writeFileSync(path.join(mailboxAttachmentsDir, storedName), content);
  await run(
    `INSERT INTO mailbox_attachments(messageId, filename, storedName, mimeType, size, createdAt)
     VALUES(?, ?, ?, ?, ?, ?)`,
    [messageId, cleanName, storedName, mimeType || "application/octet-stream", content.length, now()],
  );
}

export async function saveMailparserAttachments(messageId: number, attachments: Attachment[]) {
  for (const att of attachments) {
    const content = att.content;
    if (!content || !Buffer.isBuffer(content) || content.length === 0) continue;
    const filename = att.filename || att.cid || "attachment";
    await saveMailboxAttachment(messageId, filename, content, att.contentType || "application/octet-stream");
  }
}

export async function saveUploadedAttachments(
  messageId: number,
  files: { originalname: string; buffer: Buffer; mimetype: string; size: number }[],
) {
  for (const file of files) {
    if (!file.buffer?.length) continue;
    await saveMailboxAttachment(messageId, file.originalname, file.buffer, file.mimetype);
  }
}

export async function listAttachmentsForMessage(messageId: number) {
  return many<MailboxAttachmentRow>(
    "SELECT id, messageId, filename, storedName, mimeType, size, createdAt FROM mailbox_attachments WHERE messageId = ? ORDER BY id ASC",
    [messageId],
  );
}

export async function listAttachmentsForMessages(messageIds: number[]) {
  if (!messageIds.length) return [];
  const placeholders = messageIds.map(() => "?").join(", ");
  return many<MailboxAttachmentRow>(
    `SELECT id, messageId, filename, storedName, mimeType, size, createdAt FROM mailbox_attachments WHERE messageId IN (${placeholders}) ORDER BY id ASC`,
    messageIds,
  );
}

export async function getMailboxAttachment(id: number) {
  return one<MailboxAttachmentRow>(
    "SELECT id, messageId, filename, storedName, mimeType, size, createdAt FROM mailbox_attachments WHERE id = ?",
    [id],
  );
}

export function attachmentFilePath(storedName: string) {
  const safe = path.basename(storedName);
  return path.join(mailboxAttachmentsDir, safe);
}

export function formatAttachmentSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function attachmentCanPreview(mimeType: string) {
  return /^(image\/(jpeg|png|gif|webp)|application\/pdf|text\/plain)/i.test(mimeType);
}
