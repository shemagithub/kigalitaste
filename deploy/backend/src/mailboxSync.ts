import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { businessNotifyEmail } from "./mail.ts";
import { saveMailparserAttachments } from "./mailboxAttachments.ts";
import { count, now, one, run, setting, setSetting } from "./db.ts";

export type MailboxSyncResult = {
  ok: boolean;
  imported: number;
  skipped: number;
  error?: string;
};

function mailCredentials() {
  const user = process.env.MAIL_USER || "";
  const pass = (process.env.MAIL_PASS || "").replace(/\s+/g, "");
  return { user, pass };
}

function imapConfig() {
  const { user, pass } = mailCredentials();
  return {
    host: process.env.IMAP_HOST || process.env.MAIL_HOST || "kigalitaste.co",
    port: Number(process.env.IMAP_PORT || 993),
    user,
    pass,
  };
}

function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function messageBody(parsed: Awaited<ReturnType<typeof simpleParser>>) {
  const text = String(parsed.text || "").trim();
  if (text) return text;
  const html = String(parsed.html || "").trim();
  if (html) return html;
  return "(No message body)";
}

function isOwnAddress(email: string, mailboxUser: string) {
  return email.toLowerCase() === mailboxUser.toLowerCase();
}

async function alreadyStored(externalId: string) {
  const row = await one<{ id: number }>("SELECT id FROM mailbox_messages WHERE externalId = ?", [externalId]);
  return Boolean(row);
}

async function importMessage(opts: {
  externalId: string;
  fromEmail: string;
  fromName: string;
  subject: string;
  body: string;
  createdAt: string;
  attachments?: import("mailparser").Attachment[];
}) {
  const result = await run(
    `INSERT INTO mailbox_messages(folder, fromEmail, fromName, toUserId, toEmail, subject, body, isRead, externalId, createdAt)
     VALUES('inbox', ?, ?, NULL, ?, ?, ?, 0, ?, ?)`,
    [
      opts.fromEmail,
      opts.fromName,
      businessNotifyEmail(),
      opts.subject.slice(0, 255),
      opts.body,
      opts.externalId,
      opts.createdAt,
    ],
  );
  const messageId = Number(result.lastInsertRowid);
  if (messageId && opts.attachments?.length) {
    await saveMailparserAttachments(messageId, opts.attachments);
  }
  return messageId;
}

export function mailboxImapConfigured() {
  const { user, pass } = mailCredentials();
  return Boolean(user && pass);
}

function uidSettingKey(mailboxUser: string) {
  return `mailbox_last_uid_${mailboxUser.toLowerCase().replace(/[^a-z0-9@._-]+/g, "_")}`;
}

export async function syncMailboxInbox(): Promise<MailboxSyncResult> {
  if (!mailboxImapConfigured()) {
    return { ok: false, imported: 0, skipped: 0, error: "Mail credentials not configured (MAIL_USER / MAIL_PASS)" };
  }

  const { host, port, user, pass } = imapConfig();
  const uidKey = uidSettingKey(user);
  const client = new ImapFlow({
    host,
    port,
    secure: true,
    auth: { user, pass },
    logger: false,
    tls: { rejectUnauthorized: true },
  });

  let imported = 0;
  let skipped = 0;

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const lastUid = Number(await setting(uidKey, "0"));
      const status = await client.status("INBOX", { uidNext: true, messages: true });
      const uidNext = status.uidNext || 1;

      let range: string;
      if (lastUid > 0 && lastUid < uidNext - 1) {
        range = `${lastUid + 1}:${uidNext - 1}`;
      } else if (lastUid > 0) {
        await setSetting("mailbox_last_sync", now());
        return { ok: true, imported: 0, skipped: 0 };
      } else {
        const startUid = Math.max(1, uidNext - 100);
        range = `${startUid}:${Math.max(1, uidNext - 1)}`;
      }

      if (range.endsWith(":0") || range === "1:0") {
        await setSetting("mailbox_last_sync", now());
        return { ok: true, imported: 0, skipped: 0 };
      }

      for await (const msg of client.fetch(range, { uid: true, source: true, envelope: true })) {
        if (!msg.source) {
          skipped += 1;
          continue;
        }

        const parsed = await simpleParser(msg.source);
        const from = parsed.from?.value?.[0];
        const fromEmail = String(from?.address || parsed.from?.text || "unknown@unknown").toLowerCase();
        const fromName = String(from?.name || fromEmail);
        const subject = String(parsed.subject || msg.envelope?.subject || "(No subject)").trim();
        const body = messageBody(parsed);
        const messageId = String(parsed.messageId || "").trim();
        const externalId = messageId || `imap:${user}:${msg.uid}`;

        if (isOwnAddress(fromEmail, user)) {
          skipped += 1;
          if (msg.uid > lastUid) await setSetting(uidKey, String(msg.uid));
          continue;
        }

        if (await alreadyStored(externalId)) {
          const existing = await one<{ id: number }>("SELECT id FROM mailbox_messages WHERE externalId = ?", [externalId]);
          if (existing && parsed.attachments?.length) {
            const attCount = await count("SELECT COUNT(*) AS n FROM mailbox_attachments WHERE messageId = ?", [existing.id]);
            if (!attCount) await saveMailparserAttachments(existing.id, parsed.attachments);
          }
          skipped += 1;
          if (msg.uid > lastUid) await setSetting(uidKey, String(msg.uid));
          continue;
        }

        const createdAt = parsed.date ? new Date(parsed.date).toISOString() : now();
        await importMessage({
          externalId,
          fromEmail,
          fromName,
          subject,
          body,
          createdAt,
          attachments: parsed.attachments,
        });
        imported += 1;
        if (msg.uid > lastUid) await setSetting(uidKey, String(msg.uid));
      }
    } finally {
      lock.release();
    }

    await client.logout();
    await setSetting("mailbox_last_sync", now());
    await setSetting("mailbox_last_sync_error", "");
    return { ok: true, imported, skipped };
  } catch (err) {
    const error = (err as Error).message || "Could not sync mailbox";
    await setSetting("mailbox_last_sync_error", error);
    try {
      await client.logout();
    } catch {
      /* ignore */
    }
    return { ok: false, imported, skipped, error };
  }
}

let syncInFlight: Promise<MailboxSyncResult> | null = null;

export function syncMailboxInboxSafe() {
  if (syncInFlight) return syncInFlight;
  syncInFlight = syncMailboxInbox().finally(() => {
    syncInFlight = null;
  });
  return syncInFlight;
}

export function startMailboxSyncLoop() {
  if (!mailboxImapConfigured()) return;

  const intervalMs = Number(process.env.MAILBOX_SYNC_MS || 120_000);
  void syncMailboxInboxSafe().then((result) => {
    if (result.imported > 0) {
      console.log(`Mailbox sync: imported ${result.imported} message(s)`);
    } else if (result.error) {
      console.warn("Mailbox sync failed:", result.error);
    }
  });

  setInterval(() => {
    void syncMailboxInboxSafe().then((result) => {
      if (result.imported > 0) {
        console.log(`Mailbox sync: imported ${result.imported} new message(s)`);
      }
    });
  }, intervalMs);
}

export async function mailboxSyncStatus() {
  return {
    configured: mailboxImapConfigured(),
    lastSync: await setting("mailbox_last_sync", ""),
    lastError: await setting("mailbox_last_sync_error", ""),
    mailbox: businessNotifyEmail(),
  };
}
