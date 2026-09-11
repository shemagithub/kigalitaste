import { Download, ExternalLink, FileText, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { apiUrl, getToken } from "@/lib/api";

export type MailAttachment = {
  id: number;
  messageId: number;
  filename: string;
  mimeType: string;
  size: number;
};

function formatAttachmentSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function canPreview(mimeType: string) {
  return /^(image\/(jpeg|png|gif|webp)|application\/pdf|text\/plain)/i.test(mimeType);
}

function fileIcon(mimeType: string) {
  if (/^image\//i.test(mimeType)) return "image";
  if (/pdf/i.test(mimeType)) return "pdf";
  return "file";
}

async function fetchAttachment(att: MailAttachment, inline: boolean) {
  const token = getToken();
  const url = apiUrl(`/api/admin/mailbox/attachments/${att.id}${inline ? "?inline=1" : ""}`);
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "Could not open attachment");
  }
  return res.blob();
}

async function openAttachment(att: MailAttachment) {
  try {
    const blob = await fetchAttachment(att, canPreview(att.mimeType));
    const objectUrl = URL.createObjectURL(blob);
    if (canPreview(att.mimeType)) {
      window.open(objectUrl, "_blank", "noopener,noreferrer");
    } else {
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = att.filename;
      link.click();
    }
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Could not open attachment");
  }
}

async function downloadAttachment(att: MailAttachment) {
  try {
    const blob = await fetchAttachment(att, false);
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = att.filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Could not download attachment");
  }
}

export function MailAttachmentList({ attachments }: { attachments: MailAttachment[] }) {
  if (!attachments.length) return null;

  return (
    <div className="mt-4 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
      <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#64748b]">
        <Paperclip className="h-3.5 w-3.5" />
        {attachments.length} attachment{attachments.length === 1 ? "" : "s"}
      </p>
      <ul className="space-y-2">
        {attachments.map((att) => {
          const preview = canPreview(att.mimeType);
          const kind = fileIcon(att.mimeType);
          return (
            <li
              key={att.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-3 py-2.5"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#ecfdf5] text-[#0d9488]">
                {kind === "image" ? (
                  <Paperclip className="h-4 w-4" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => void openAttachment(att)}
                  className="block max-w-full truncate text-left text-sm font-semibold text-[#0d9488] hover:underline"
                  title={att.filename}
                >
                  {att.filename}
                </button>
                <p className="text-xs text-[#94a3b8]">
                  {formatAttachmentSize(att.size)}
                  {att.mimeType ? ` · ${att.mimeType.split("/").pop()?.toUpperCase()}` : null}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {preview ? (
                  <button
                    type="button"
                    onClick={() => void openAttachment(att)}
                    className="inline-flex items-center gap-1 rounded-full border border-[#e2e8f0] px-2.5 py-1 text-xs font-medium text-[#475569] hover:bg-[#f8fafc]"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Open
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void downloadAttachment(att)}
                  className="inline-flex items-center gap-1 rounded-full border border-[#e2e8f0] px-2.5 py-1 text-xs font-medium text-[#475569] hover:bg-[#f8fafc]"
                >
                  <Download className="h-3 w-3" />
                  Download
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
