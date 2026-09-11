import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronLeft,
  Italic,
  Link2,
  List,
  ListOrdered,
  Paperclip,
  Send,
  Underline,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Btn } from "../ui";

type MailComposePanelProps = {
  mode: "compose" | "reply";
  fromEmail: string;
  fromName: string;
  initialTo?: string[];
  initialSubject?: string;
  initialHtml?: string;
  replyParentId?: number;
  onSent: () => void;
  onCancel: () => void;
};

function parseEmailInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/<([^>]+@[^>]+)>/);
  const email = (match ? match[1] : trimmed).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function htmlToPlain(html: string) {
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent || div.innerText || "").replace(/\s+/g, " ").trim();
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

const TOOLBAR = [
  { cmd: "bold", icon: Bold, label: "Bold" },
  { cmd: "italic", icon: Italic, label: "Italic" },
  { cmd: "underline", icon: Underline, label: "Underline" },
  { cmd: "separator" },
  { cmd: "justifyLeft", icon: AlignLeft, label: "Align left" },
  { cmd: "justifyCenter", icon: AlignCenter, label: "Align center" },
  { cmd: "justifyRight", icon: AlignRight, label: "Align right" },
  { cmd: "separator" },
  { cmd: "insertUnorderedList", icon: List, label: "Bullet list" },
  { cmd: "insertOrderedList", icon: ListOrdered, label: "Numbered list" },
  { cmd: "separator" },
  { cmd: "createLink", icon: Link2, label: "Insert link" },
] as const;

export function MailComposePanel({
  mode,
  fromEmail,
  fromName,
  initialTo = [],
  initialSubject = "",
  initialHtml = "",
  replyParentId,
  onSent,
  onCancel,
}: MailComposePanelProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [toChips, setToChips] = useState<string[]>(initialTo);
  const [toInput, setToInput] = useState("");
  const [subject, setSubject] = useState(initialSubject);
  const [showBcc, setShowBcc] = useState(false);
  const [showReplyTo, setShowReplyTo] = useState(false);
  const [bcc, setBcc] = useState("");
  const [replyTo, setReplyTo] = useState(fromEmail);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (editorRef.current && initialHtml) {
      editorRef.current.innerHTML = initialHtml;
    }
  }, [initialHtml]);

  const exec = useCallback((command: string) => {
    if (command === "createLink") {
      const url = window.prompt("Link URL", "https://");
      if (url) document.execCommand("createLink", false, url);
      return;
    }
    document.execCommand(command, false);
    editorRef.current?.focus();
  }, []);

  function addRecipient(raw: string) {
    const email = parseEmailInput(raw);
    if (!email) {
      if (raw.trim()) toast.error("Enter a valid email address");
      return;
    }
    setToChips((prev) => (prev.includes(email) ? prev : [...prev, email]));
    setToInput("");
  }

  function removeRecipient(email: string) {
    setToChips((prev) => prev.filter((e) => e !== email));
  }

  function handleToKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "," || e.key === ";") {
      e.preventDefault();
      addRecipient(toInput);
    } else if (e.key === "Backspace" && !toInput && toChips.length) {
      setToChips((prev) => prev.slice(0, -1));
    }
  }

  function addFiles(files: FileList | File[]) {
    const next = [...attachments];
    for (const file of Array.from(files)) {
      if (next.length >= 5) {
        toast.error("Maximum 5 attachments");
        break;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 10 MB)`);
        continue;
      }
      next.push(file);
    }
    setAttachments(next);
  }

  async function handleSend() {
    const htmlBody = editorRef.current?.innerHTML || "";
    const plain = htmlToPlain(htmlBody);
    if (mode === "compose" && !toChips.length) {
      toast.error("Add at least one recipient");
      return;
    }
    if (!subject.trim()) {
      toast.error("Subject is required");
      return;
    }
    if (!plain) {
      toast.error("Write a message");
      return;
    }

    const form = new FormData();
    if (mode === "reply" && replyParentId) {
      form.append("parentId", String(replyParentId));
    } else {
      form.append("toEmail", toChips.join(", "));
    }
    form.append("subject", subject.trim());
    form.append("body", plain);
    form.append("htmlBody", htmlBody);
    if (bcc.trim()) form.append("bcc", bcc.trim());
    if (replyTo.trim() && replyTo.trim() !== fromEmail) form.append("replyTo", replyTo.trim());
    for (const file of attachments) form.append("attachments", file);

    setSending(true);
    try {
      const path = mode === "reply" ? "/api/admin/mailbox/reply" : "/api/admin/mailbox/compose";
      await api(path, { method: "POST", form });
      toast.success(mode === "reply" ? "Reply sent" : "Email sent");
      onSent();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send email");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#e2e8f0] bg-[#f8fafc] px-4 py-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e2e8f0] bg-white text-[#64748b] hover:bg-[#f1f5f9]"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h2 className="text-lg font-bold text-[#0d9488]">{mode === "reply" ? "Reply" : "Compose"}</h2>
        </div>
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={sending}
          className="flex items-center gap-2 rounded-full bg-[#0d9488] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-105 disabled:opacity-60"
        >
          <Send className="h-4 w-4" />
          {sending ? "Sending…" : "Send"}
        </button>
      </div>

      {/* Fields */}
      <div className="border-b border-[#e2e8f0] px-4 py-2">
        <div className="flex items-center gap-3 border-b border-[#f1f5f9] py-2.5">
          <span className="w-14 shrink-0 text-sm font-medium text-[#64748b]">From</span>
          <div className="min-w-0 flex-1 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-sm text-[#475569]">
            {fromName} &lt;{fromEmail}&gt;
          </div>
        </div>

        {mode === "compose" ? (
          <div className="flex items-start gap-3 border-b border-[#f1f5f9] py-2.5">
            <span className="w-14 shrink-0 pt-2 text-sm font-medium text-[#64748b]">To</span>
            <div className="min-w-0 flex-1">
              <div className="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-white px-2 py-1.5 focus-within:border-[#0d9488] focus-within:ring-2 focus-within:ring-[#0d9488]/15">
                {toChips.map((email) => (
                  <span
                    key={email}
                    className="inline-flex max-w-full items-center gap-1 rounded-full bg-[#ccfbf1] px-2.5 py-1 text-xs font-medium text-[#0f766e]"
                  >
                    <span className="truncate">{email}</span>
                    <button type="button" onClick={() => removeRecipient(email)} className="rounded-full hover:bg-[#99f6e4]">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <input
                  value={toInput}
                  onChange={(e) => setToInput(e.target.value)}
                  onKeyDown={handleToKeyDown}
                  onBlur={() => toInput.trim() && addRecipient(toInput)}
                  placeholder={toChips.length ? "Add another…" : "Recipient email"}
                  className="min-w-[120px] flex-1 border-0 bg-transparent py-1 text-sm outline-none"
                />
              </div>
              <div className="mt-1.5 flex gap-3 text-xs">
                {!showBcc ? (
                  <button type="button" className="font-semibold text-[#0d9488] hover:underline" onClick={() => setShowBcc(true)}>
                    (+) Add Bcc
                  </button>
                ) : null}
                {!showReplyTo ? (
                  <button type="button" className="font-semibold text-[#0d9488] hover:underline" onClick={() => setShowReplyTo(true)}>
                    (+) Add Reply-To
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 border-b border-[#f1f5f9] py-2.5">
            <span className="w-14 shrink-0 text-sm font-medium text-[#64748b]">To</span>
            <div className="min-w-0 flex-1 text-sm text-[#475569]">{initialTo.join(", ")}</div>
          </div>
        )}

        {showBcc ? (
          <div className="flex items-center gap-3 border-b border-[#f1f5f9] py-2.5">
            <span className="w-14 shrink-0 text-sm font-medium text-[#64748b]">Bcc</span>
            <input
              value={bcc}
              onChange={(e) => setBcc(e.target.value)}
              placeholder="Hidden recipients, comma-separated"
              className="min-w-0 flex-1 rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm outline-none focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/15"
            />
          </div>
        ) : null}

        {showReplyTo ? (
          <div className="flex items-center gap-3 border-b border-[#f1f5f9] py-2.5">
            <span className="w-14 shrink-0 text-sm font-medium text-[#64748b]">Reply-To</span>
            <input
              value={replyTo}
              onChange={(e) => setReplyTo(e.target.value)}
              placeholder={fromEmail}
              className="min-w-0 flex-1 rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm outline-none focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/15"
            />
          </div>
        ) : null}

        <div className="flex items-center gap-3 py-2.5">
          <span className="w-14 shrink-0 text-sm font-medium text-[#64748b]">Subject</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            readOnly={mode === "reply"}
            className="min-w-0 flex-1 rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm outline-none focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/15 read-only:bg-[#f8fafc] read-only:text-[#64748b]"
          />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-[#e2e8f0] bg-[#f1f5f9] px-2 py-1.5">
        {TOOLBAR.map((item, idx) =>
          item.cmd === "separator" ? (
            <span key={`sep-${idx}`} className="mx-1 h-6 w-px bg-[#cbd5e1]" />
          ) : (
            <button
              key={item.cmd}
              type="button"
              title={item.label}
              onClick={() => exec(item.cmd)}
              className="rounded p-1.5 text-[#475569] hover:bg-white hover:text-[#0d9488]"
            >
              <item.icon className="h-4 w-4" />
            </button>
          ),
        )}
      </div>

      {/* Editor */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          data-placeholder="Write your message…"
          className="min-h-[220px] rounded-lg border border-[#e2e8f0] bg-white px-4 py-3 text-sm leading-relaxed text-[#334155] outline-none focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10 empty:before:text-[#94a3b8] empty:before:content-[attr(data-placeholder)]"
        />
      </div>

      {/* Attachments */}
      <div
        className={`border-t border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 transition ${dragOver ? "bg-[#ccfbf1]" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 text-sm font-medium text-[#0d9488] hover:underline"
        >
          <Paperclip className="h-4 w-4" />
          Drag files here to attach them
        </button>
        {attachments.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {attachments.map((file, idx) => (
              <li key={`${file.name}-${idx}`} className="flex items-center justify-between rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm">
                <span className="truncate font-medium text-[#475569]">
                  {file.name}{" "}
                  <span className="font-normal text-[#94a3b8]">({formatBytes(file.size)})</span>
                </span>
                <button
                  type="button"
                  onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                  className="ml-2 rounded p-1 text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#ef4444]"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-3 flex justify-end gap-2 lg:hidden">
          <Btn variant="ghost" onClick={onCancel}>
            Cancel
          </Btn>
          <Btn onClick={() => void handleSend()} disabled={sending}>
            <Send className="h-4 w-4" />
            Send
          </Btn>
        </div>
      </div>
    </div>
  );
}
