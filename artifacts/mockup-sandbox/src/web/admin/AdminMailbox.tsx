import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Archive,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Mail,
  MoreHorizontal,
  Plus,
  Printer,
  RefreshCw,
  Reply,
  Search,
  Send,
  Star,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/api";
import { useSettings } from "../catalog";
import { Btn } from "../ui";
import { MailComposePanel } from "./MailComposePanel";
import { MailAttachmentList, type MailAttachment } from "./MailAttachmentList";

type MailRow = {
  id: number;
  folder: string;
  fromName: string;
  fromEmail: string;
  toEmail: string | null;
  subject: string;
  body: string;
  isRead: number;
  parentId: number | null;
  createdAt: string;
};

type FolderStats = Record<string, { total: number; unread: number }>;

type SyncStatus = {
  configured: boolean;
  lastSync: string;
  lastError: string;
  mailbox: string;
};

type StatsResponse = FolderStats & { sync?: SyncStatus };

type FolderId = "inbox" | "sent" | "all" | "archived" | "trash";

type ComposeMode = null | { kind: "compose" } | { kind: "reply"; message: MailRow };

const FOLDERS: { id: FolderId; label: string; icon: typeof Inbox }[] = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "sent", label: "Sent", icon: Send },
  { id: "all", label: "All mail", icon: Mail },
  { id: "archived", label: "Archived", icon: Archive },
  { id: "trash", label: "Trash", icon: Trash2 },
];

function formatMailDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  if (sameYear && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("en-GB", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

function formatFullDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function snippet(body: string, max = 88) {
  const clean = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max)}…`;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

function senderLabel(row: MailRow, folder: FolderId) {
  if (folder === "sent") return row.toEmail || "Recipient";
  return row.fromName || row.fromEmail;
}

function looksLikeHtml(body: string) {
  return /<(?:p|div|br|ul|ol|li|strong|em|a|h[1-6])\b/i.test(body);
}

function replySubject(subject: string) {
  return subject.startsWith("Re:") ? subject : `Re: ${subject}`;
}

export function AdminMailbox() {
  const settings = useSettings();
  const [folder, setFolder] = useState<FolderId>("inbox");
  const [rows, setRows] = useState<MailRow[]>([]);
  const [stats, setStats] = useState<FolderStats>({});
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [thread, setThread] = useState<MailRow[]>([]);
  const [attachmentsByMessage, setAttachmentsByMessage] = useState<Record<number, MailAttachment[]>>({});
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [composeMode, setComposeMode] = useState<ComposeMode>(null);
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");
  const [starred, setStarred] = useState<number[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("kt_mail_stars") || "[]") as number[];
    } catch {
      return [];
    }
  });

  const fromEmail = settings?.email || "info@kigalitaste.co";
  const platformEmail = fromEmail;
  const platformName = settings?.platformName || "Kigali Taste";

  const reloadStats = useCallback(async () => {
    const data = await api<StatsResponse>("/api/admin/mailbox/stats");
    const { sync, ...folders } = data;
    setStats(folders);
    if (sync) setSyncStatus(sync);
  }, []);

  const reloadList = useCallback(async () => {
    const q = search.trim();
    const params = new URLSearchParams({ folder });
    if (q) params.set("q", q);
    if (filter === "unread") params.set("unread", "1");
    setRows(await api<MailRow[]>(`/api/admin/mailbox?${params}`));
  }, [folder, search, filter]);

  const syncMailbox = useCallback(async (manual = false) => {
    setSyncing(true);
    try {
      const result = await api<{ imported: number; ok: boolean; sync: SyncStatus }>(
        "/api/admin/mailbox/sync",
        { method: "POST" },
      );
      setSyncStatus(result.sync);
      if (manual) {
        if (result.imported > 0) toast.success(`Imported ${result.imported} new message(s)`);
        else toast.success("Inbox is up to date");
      }
      await reloadStats();
      await reloadList();
    } catch (err) {
      if (manual) toast.error(err instanceof Error ? err.message : "Could not sync inbox");
      try {
        setSyncStatus(await api<SyncStatus>("/api/admin/mailbox/sync-status"));
      } catch {
        /* ignore */
      }
    } finally {
      setSyncing(false);
    }
  }, [reloadStats, reloadList]);

  useEffect(() => {
    void reloadStats().catch((e) => toast.error(e.message));
    void syncMailbox(false);
    const id = window.setInterval(() => void syncMailbox(false), 120_000);
    return () => window.clearInterval(id);
  }, [reloadStats, syncMailbox]);

  useEffect(() => {
    void reloadList()
      .catch((e) => toast.error(e.message))
      .then(() => setSelectedId(null));
  }, [reloadList]);

  const current = rows.find((r) => r.id === selectedId) || null;
  const currentIndex = current ? rows.findIndex((r) => r.id === current.id) : -1;

  useEffect(() => {
    if (!selectedId) {
      setThread([]);
      setAttachmentsByMessage({});
      return;
    }
    void api<{ thread: MailRow[]; attachments?: MailAttachment[] }>(`/api/admin/mailbox/${selectedId}`)
      .then((data) => {
        setThread(data.thread || []);
        const grouped: Record<number, MailAttachment[]> = {};
        for (const att of data.attachments || []) {
          if (!grouped[att.messageId]) grouped[att.messageId] = [];
          grouped[att.messageId].push(att);
        }
        setAttachmentsByMessage(grouped);
      })
      .catch(() => {
        setThread(current ? [current] : []);
        setAttachmentsByMessage({});
      });
  }, [selectedId]);

  function openCompose() {
    setComposeMode({ kind: "compose" });
    setMobileView("detail");
  }

  function openReply(message: MailRow) {
    setComposeMode({ kind: "reply", message });
    setMobileView("detail");
  }

  function closeCompose() {
    setComposeMode(null);
  }

  async function onMailSent() {
    closeCompose();
    if (composeMode?.kind === "reply") {
      setSelectedId(composeMode.message.id);
    }
    setFolder("sent");
    await reloadList();
    await reloadStats();
  }

  async function openMessage(id: number) {
    setSelectedId(id);
    setComposeMode(null);
    setMobileView("detail");
    await api(`/api/admin/mailbox/${id}/read`, { method: "POST", json: { isRead: true } });
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, isRead: 1 } : r)));
    void reloadStats();
  }

  async function markUnread(id: number) {
    await api(`/api/admin/mailbox/${id}/read`, { method: "POST", json: { isRead: false } });
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, isRead: 0 } : r)));
    void reloadStats();
  }

  function toggleStar(id: number) {
    setStarred((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      localStorage.setItem("kt_mail_stars", JSON.stringify(next));
      return next;
    });
  }

  async function archiveMessage(id: number) {
    await api(`/api/admin/mailbox/${id}/archive`, { method: "POST" });
    toast.success("Archived");
    setSelectedId(null);
    setComposeMode(null);
    setMobileView("list");
    await reloadList();
    await reloadStats();
  }

  async function trashMessage(id: number) {
    await api(`/api/admin/mailbox/${id}/trash`, { method: "POST" });
    toast.success("Moved to trash");
    setSelectedId(null);
    setComposeMode(null);
    setMobileView("list");
    await reloadList();
    await reloadStats();
  }

  const folderMeta = FOLDERS.find((f) => f.id === folder)!;
  const folderStats = stats[folder] || stats.all || { total: rows.length, unread: rows.filter((r) => !r.isRead).length };

  const labelCounts = useMemo(() => {
    const customers = rows.filter((r) => r.folder === "inbox" && !r.fromEmail.includes("newsletter")).length;
    const partners = rows.filter((r) => /vendor|partner|kitchen/i.test(r.subject + r.body)).length;
    const newsletter = rows.filter((r) => /newsletter|subscribe/i.test(r.subject + r.body)).length;
    return { customers, partners, newsletter };
  }, [rows]);

  const showDetailPane = composeMode || current || mobileView === "detail";

  return (
    <div className="flex min-h-[min(720px,calc(100dvh-8rem))] flex-col overflow-hidden rounded-[1.5rem] border border-black/5 bg-[#f4f6fb] shadow-sm">
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Sidebar */}
        <aside
          className={`w-full shrink-0 border-b border-black/5 bg-white p-4 lg:w-[240px] lg:border-b-0 lg:border-r xl:w-[260px] ${
            mobileView === "detail" ? "hidden lg:block" : "block"
          }`}
        >
          <div className="mb-5 flex items-center gap-3 px-1">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0d9488] text-sm font-bold text-white">
              {initials(platformName)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[#1e293b]">{platformName}</p>
              <p className="truncate text-xs text-[#64748b]">{platformEmail}</p>
              <p className="truncate text-[10px] text-[#94a3b8]">Receiving via IMAP · {platformEmail}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={openCompose}
            className="mb-6 flex w-full items-center justify-center gap-2 rounded-full bg-[#0d9488] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#0d9488]/25 transition hover:brightness-105"
          >
            <Plus className="h-4 w-4" />
            New message
          </button>

          <nav className="space-y-0.5">
            {FOLDERS.map(({ id, label, icon: Icon }) => {
              const active = folder === id;
              const count = stats[id]?.total ?? 0;
              const unread = stats[id]?.unread ?? 0;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setFolder(id);
                    setSelectedId(null);
                    setComposeMode(null);
                    setMobileView("list");
                  }}
                  className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                    active ? "bg-[#ccfbf1] font-semibold text-[#0d9488]" : "text-[#475569] hover:bg-[#f8fafc]"
                  }`}
                >
                  {active ? <span className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-[#0d9488]" /> : null}
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  <span className="flex items-center gap-1.5 text-xs">
                    {unread > 0 ? (
                      <span className="rounded-full bg-[#ef4444] px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {unread}
                      </span>
                    ) : null}
                    <span className="text-[#94a3b8]">{count}</span>
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="mt-8">
            <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#94a3b8]">Labels</p>
            <div className="space-y-0.5">
              {[
                { label: "Customers", color: "bg-emerald-500", count: labelCounts.customers },
                { label: "Partners", color: "bg-blue-500", count: labelCounts.partners },
                { label: "Newsletter", color: "bg-violet-500", count: labelCounts.newsletter },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[#475569] hover:bg-[#f8fafc]"
                  onClick={() => setSearch(item.label.toLowerCase())}
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                  <span className="flex-1">{item.label}</span>
                  <span className="text-xs text-[#94a3b8]">{item.count}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Message list */}
        <section
          className={`flex min-h-0 w-full shrink-0 flex-col border-b border-black/5 bg-white lg:w-[340px] lg:border-b-0 lg:border-r xl:w-[380px] ${
            mobileView === "detail" ? "hidden lg:flex" : "flex"
          }`}
        >
          <div className="border-b border-black/5 p-4">
            <h2 className="text-xl font-bold text-[#1e293b]">{folderMeta.label}</h2>
            <p className="mt-0.5 text-xs text-[#64748b]">
              {folderStats.total} messages · {folderStats.unread} unread
              {syncStatus?.lastSync ? (
                <>
                  {" "}
                  · Synced{" "}
                  {formatMailDate(syncStatus.lastSync)}
                </>
              ) : null}
            </p>
            {syncStatus?.lastError ? (
              <p className="mt-1 text-xs text-red-600">Inbox sync: {syncStatus.lastError}</p>
            ) : null}
            <div className="mt-3 flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search mail"
                  className="h-10 w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] pl-9 pr-3 text-sm outline-none focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/15"
                />
              </div>
              <button
                type="button"
                onClick={() => void syncMailbox(true)}
                disabled={syncing}
                title="Sync inbox from email server"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#e2e8f0] bg-white text-[#475569] hover:bg-[#f8fafc] disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              </button>
              <button
                type="button"
                onClick={openCompose}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#e2e8f0] bg-white text-[#475569] hover:bg-[#f8fafc] lg:hidden"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="relative mt-2">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as "all" | "unread")}
                className="h-9 w-full appearance-none rounded-lg border border-[#e2e8f0] bg-white px-3 pr-8 text-sm text-[#475569] outline-none"
              >
                <option value="all">All messages</option>
                <option value="unread">Unread only</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {rows.length === 0 ? (
              <p className="p-6 text-center text-sm text-[#64748b]">No messages in this folder.</p>
            ) : (
              rows.map((m) => {
                const active = selectedId === m.id && !composeMode;
                const isStarred = starred.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => void openMessage(m.id)}
                    className={`relative block w-full border-b border-[#f1f5f9] px-4 py-3.5 text-left transition ${
                      active ? "bg-[#f0fdfa]" : "hover:bg-[#f8fafc]"
                    }`}
                  >
                    {active ? <span className="absolute left-0 top-0 bottom-0 w-1 bg-[#0d9488]" /> : null}
                    <div className="flex items-start gap-2">
                      {!m.isRead ? <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#0d9488]" /> : <span className="w-2 shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`truncate text-sm ${m.isRead ? "font-medium text-[#475569]" : "font-bold text-[#1e293b]"}`}>
                            {senderLabel(m, folder)}
                          </p>
                          <span className="shrink-0 text-[11px] text-[#94a3b8]">{formatMailDate(m.createdAt)}</span>
                        </div>
                        <p className={`mt-0.5 truncate text-sm ${m.isRead ? "text-[#64748b]" : "font-semibold text-[#1e293b]"}`}>
                          {m.subject}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#94a3b8]">{snippet(m.body)}</p>
                        {isStarred ? (
                          <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600">
                            <Star className="h-3 w-3 fill-current" /> Starred
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* Message detail / compose */}
        <section
          className={`min-h-0 min-w-0 flex-1 flex-col bg-white ${showDetailPane ? "flex" : "hidden lg:flex"} ${
            mobileView === "list" && !composeMode && !selectedId ? "hidden lg:flex" : ""
          }`}
        >
          {composeMode?.kind === "compose" ? (
            <MailComposePanel
              mode="compose"
              fromEmail={fromEmail}
              fromName={platformName}
              onSent={() => void onMailSent()}
              onCancel={closeCompose}
            />
          ) : composeMode?.kind === "reply" ? (
            <MailComposePanel
              mode="reply"
              fromEmail={fromEmail}
              fromName={platformName}
              initialTo={[composeMode.message.fromEmail]}
              initialSubject={replySubject(composeMode.message.subject)}
              initialHtml={`<p><br></p><p><br></p><blockquote style="margin:0;padding-left:12px;border-left:3px solid #cbd5e1;color:#64748b">On ${formatFullDate(composeMode.message.createdAt)}, ${composeMode.message.fromName || composeMode.message.fromEmail} wrote:<br>${composeMode.message.body.replace(/\n/g, "<br>")}</blockquote>`}
              replyParentId={composeMode.message.id}
              onSent={() => void onMailSent()}
              onCancel={closeCompose}
            />
          ) : !current ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-[#64748b]">
              <Mail className="mb-3 h-10 w-10 text-[#cbd5e1]" />
              <p className="font-semibold text-[#475569]">Select a message</p>
              <p className="mt-1 max-w-xs text-sm">Choose an email from the list or compose a new message.</p>
              <button
                type="button"
                onClick={openCompose}
                className="mt-4 rounded-full bg-[#0d9488] px-5 py-2 text-sm font-semibold text-white hover:brightness-105"
              >
                Compose new message
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b border-[#f1f5f9] px-4 py-3">
                <button
                  type="button"
                  className="rounded-lg p-2 text-[#64748b] hover:bg-[#f8fafc] lg:hidden"
                  onClick={() => setMobileView("list")}
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="flex items-center gap-1 text-xs text-[#64748b]">
                  <button
                    type="button"
                    disabled={currentIndex <= 0}
                    className="rounded p-1 hover:bg-[#f8fafc] disabled:opacity-40"
                    onClick={() => currentIndex > 0 && void openMessage(rows[currentIndex - 1].id)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span>
                    {currentIndex + 1} of {rows.length}
                  </span>
                  <button
                    type="button"
                    disabled={currentIndex < 0 || currentIndex >= rows.length - 1}
                    className="rounded p-1 hover:bg-[#f8fafc] disabled:opacity-40"
                    onClick={() => currentIndex >= 0 && currentIndex < rows.length - 1 && void openMessage(rows[currentIndex + 1].id)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <div className="ml-auto flex items-center gap-1">
                  {folder === "inbox" ? (
                    <button
                      type="button"
                      className="rounded-lg p-2 text-[#64748b] hover:bg-[#f8fafc]"
                      title="Reply"
                      onClick={() => openReply(current)}
                    >
                      <Reply className="h-4 w-4" />
                    </button>
                  ) : null}
                  <button type="button" className="rounded-lg p-2 text-[#64748b] hover:bg-[#f8fafc]" onClick={() => window.print()}>
                    <Printer className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="rounded-lg p-2 text-[#64748b] hover:bg-[#f8fafc]"
                    onClick={() => void trashMessage(current.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="rounded-lg p-2 text-[#64748b] hover:bg-[#f8fafc]"
                    onClick={() => toggleStar(current.id)}
                  >
                    <Star className={`h-4 w-4 ${starred.includes(current.id) ? "fill-amber-400 text-amber-400" : ""}`} />
                  </button>
                  <button type="button" className="rounded-lg p-2 text-[#64748b] hover:bg-[#f8fafc]">
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-5 lg:p-6">
                {thread.map((msg, idx) => (
                  <article key={msg.id} className={idx > 0 ? "mt-8 border-t border-[#f1f5f9] pt-8" : ""}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ccfbf1] text-sm font-bold text-[#0d9488]">
                          {initials(msg.fromName || msg.fromEmail)}
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold text-[#1e293b]">{msg.fromName || msg.fromEmail}</p>
                          <p className="text-xs text-[#64748b]">
                            From <span className="font-medium">{msg.fromEmail}</span>
                            {msg.toEmail ? (
                              <>
                                {" "}
                                · To <span className="font-medium">{msg.toEmail}</span>
                              </>
                            ) : null}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-[#94a3b8]">{formatFullDate(msg.createdAt)}</p>
                    </div>

                    <h1 className="mt-5 text-xl font-bold leading-snug text-[#1e293b] lg:text-2xl">{msg.subject}</h1>
                    {looksLikeHtml(msg.body) ? (
                      <div
                        className="prose prose-sm mt-4 max-w-none overflow-x-auto break-words text-[#334155] [&_*]:max-w-full [&_img]:h-auto [&_table]:block [&_table]:overflow-x-auto"
                        dangerouslySetInnerHTML={{ __html: msg.body }}
                      />
                    ) : (
                      <div className="mt-4 overflow-x-auto break-words whitespace-pre-wrap text-sm leading-relaxed text-[#334155]">{msg.body}</div>
                    )}
                    <MailAttachmentList attachments={attachmentsByMessage[msg.id] || []} />
                  </article>
                ))}

                {folder === "inbox" && (
                  <div className="mt-8 flex flex-wrap gap-2 border-t border-[#f1f5f9] pt-6">
                    <Btn onClick={() => openReply(current)}>
                      <Reply className="h-4 w-4" />
                      Reply
                    </Btn>
                    <Btn variant="ghost" onClick={() => void archiveMessage(current.id)}>
                      <Archive className="h-4 w-4" />
                      Archive
                    </Btn>
                    <Btn variant="ghost" onClick={() => void markUnread(current.id)}>
                      Mark unread
                    </Btn>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
