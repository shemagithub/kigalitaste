import { Link } from "wouter";
import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { ExternalLink, FileText, ImagePlus, Link2, UserRound, X } from "lucide-react";
import { frw, img, apiUrl, API_BASE } from "@/lib/api";
import { cn } from "@/lib/utils";

export type BtnVariant = "primary" | "light" | "outline" | "ghost" | "panel" | "destructive";

const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-full font-bold transition hover:brightness-[1.03] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

const btnVariants: Record<BtnVariant, string> = {
  primary: "bg-primary text-white shadow-lg shadow-primary/25 hover:shadow-primary/35",
  light: "bg-white text-foreground shadow-card hover:bg-white/95",
  outline: "border-2 border-foreground/15 bg-white text-foreground hover:bg-muted/40",
  ghost: "bg-muted text-foreground hover:bg-muted/80",
  panel: "bg-[#0d4f46] text-white shadow-md hover:brightness-110",
  destructive: "bg-destructive text-white shadow-md hover:brightness-105",
};

const btnSizes = {
  sm: "min-h-9 px-4 py-2 text-xs",
  md: "min-h-11 px-6 py-3 text-sm",
  lg: "min-h-12 px-8 py-3.5 text-base",
};

export function btnStyles(
  variant: BtnVariant = "primary",
  className?: string,
  size: keyof typeof btnSizes = "md",
) {
  return cn(btnBase, btnSizes[size], btnVariants[variant], className);
}

export function Btn({
  children,
  className = "",
  variant = "primary",
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant;
  size?: keyof typeof btnSizes;
}) {
  return (
    <button {...props} className={btnStyles(variant, className, size)}>
      {children}
    </button>
  );
}

export function BtnLink({
  href,
  children,
  className = "",
  variant = "primary",
  size = "md",
}: {
  href: string;
  children: ReactNode;
  className?: string;
  variant?: BtnVariant;
  size?: keyof typeof btnSizes;
}) {
  return (
    <Link href={href} className={btnStyles(variant, className, size)}>
      {children}
    </Link>
  );
}

export function GhostBtn({
  children,
  className = "",
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: keyof typeof btnSizes;
}) {
  return (
    <button {...props} className={btnStyles("ghost", className, size)}>
      {children}
    </button>
  );
}

export function BrandName({
  name,
  light = false,
  size = "md",
  className = "",
}: {
  name: string;
  light?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClass =
    size === "sm"
      ? "text-[1.2rem] sm:text-[1.35rem]"
      : size === "lg"
        ? "text-[1.95rem] sm:text-[2.35rem]"
        : "text-[1.55rem] sm:text-[1.85rem]";
  return (
    <span
      className={`font-brand block leading-none tracking-wide ${sizeClass} ${
        light ? "text-white" : "text-foreground"
      } ${className}`}
    >
      {name}
    </span>
  );
}

const DEFAULT_FAVICON =
  "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🍽️</text></svg>";

function faviconType(href: string) {
  const clean = href.split("?")[0].toLowerCase();
  if (clean.startsWith("data:image/svg") || clean.endsWith(".svg") || clean.includes("/api/brand/icon")) {
    return "image/svg+xml";
  }
  if (clean.endsWith(".png")) return "image/png";
  if (clean.endsWith(".webp")) return "image/webp";
  if (clean.endsWith(".gif")) return "image/gif";
  if (clean.endsWith(".ico")) return "image/x-icon";
  if (clean.endsWith(".jpg") || clean.endsWith(".jpeg")) return "image/jpeg";
  return undefined;
}

function setBrandIconLinks(href: string) {
  document
    .querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')
    .forEach((el) => el.remove());

  const type = faviconType(href);
  for (const rel of ["icon", "shortcut icon", "apple-touch-icon"] as const) {
    if (rel === "apple-touch-icon" && href.startsWith("data:")) continue;
    const link = document.createElement("link");
    link.rel = rel;
    if (type && !href.includes("/api/brand/icon")) link.type = type;
    // For brand/icon endpoint, omit type so browser sniffs jpeg/png/svg correctly.
    link.href = href;
    document.head.appendChild(link);
  }
}

/** Keep the browser tab icon in sync with admin brand logo / favicon from settings. */
export function applyBrandAssets(settings?: Record<string, string> | null) {
  if (typeof document === "undefined") return;

  const raw = String(settings?.faviconUrl || settings?.logoUrl || "").trim();
  const stamp = encodeURIComponent((raw || "default").slice(-32));

  // Prefer the API brand-icon endpoint so hosted frontend (kigalitaste.co) always
  // hits the backend subdomain with a stable URL (and SVG fallback if file missing).
  const href = API_BASE
    ? apiUrl(`/api/brand/icon?v=${stamp}`)
    : raw
      ? img(raw)
      : DEFAULT_FAVICON;

  setBrandIconLinks(href);

  const name = String(settings?.platformName || "").trim();
  if (name && (!document.title || document.title === "Kigali Taste — food delivered in Kigali")) {
    const nextTitle = `${name} — food delivered in Kigali`;
    if (document.title !== nextTitle) document.title = nextTitle;
  }
}

function BrandMarkFallback({
  name,
  sizeClass,
}: {
  name: string;
  sizeClass: string;
}) {
  const initial = (name.trim()[0] || "K").toUpperCase();
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-primary font-bold text-white shadow-md shadow-primary/30 ${sizeClass}`}
      aria-hidden
    >
      {initial}
    </span>
  );
}

export function Logo({
  settings,
  light = false,
}: {
  settings?: Record<string, string>;
  light?: boolean;
}) {
  const name = settings?.platformName || "Kigali Taste";
  const logoUrl = String(settings?.logoUrl || "").trim();
  const [broken, setBroken] = useState(false);
  const sizeClass = "h-11 w-11 sm:h-14 sm:w-14";

  useEffect(() => {
    setBroken(false);
  }, [logoUrl]);

  return (
    <Link href="/" className="flex min-w-0 shrink items-center gap-2 sm:gap-2.5">
      {logoUrl && !broken ? (
        <img
          src={img(logoUrl)}
          alt=""
          className={`${sizeClass} shrink-0 rounded-full bg-white object-cover shadow-md shadow-black/10 ring-2 ring-white/80`}
          onError={() => setBroken(true)}
        />
      ) : (
        <BrandMarkFallback name={name} sizeClass={sizeClass} />
      )}
      <span className={`min-w-0 leading-tight ${light ? "text-white" : "text-foreground"}`}>
        <BrandName name={name} light={light} size="sm" />
        <span
          className={`hidden truncate text-[10px] font-semibold uppercase tracking-[0.18em] sm:block ${
            light ? "text-white/70" : "text-primary"
          }`}
        >
          Restaurant
        </span>
      </span>
    </Link>
  );
}

export function UserAvatar({
  user,
  size = "md",
  className = "",
}: {
  user?: { firstName: string; lastName?: string; avatarUrl?: string | null } | null;
  size?: "sm" | "md";
  className?: string;
}) {
  const box = size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";

  if (!user) {
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-secondary text-foreground/60",
          box,
          className,
        )}
      >
        <UserRound className={size === "sm" ? "h-4 w-4" : "h-[18px] w-[18px]"} />
      </span>
    );
  }

  const initial = (user.firstName?.trim()[0] || user.lastName?.trim()[0] || "?").toUpperCase();
  const avatar = user.avatarUrl?.trim();

  if (avatar) {
    return (
      <img
        src={img(avatar)}
        alt=""
        className={cn("shrink-0 rounded-full object-cover ring-2 ring-white", box, className)}
      />
    );
  }

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary font-bold uppercase text-white shadow-sm shadow-primary/25",
        box,
        className,
      )}
    >
      {initial}
    </span>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl bg-white p-4 shadow-card sm:p-5 ${className}`}>{children}</div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-11 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none ring-primary/25 focus:ring-2 ${props.className || ""}`}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-28 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none ring-primary/25 focus:ring-2 ${props.className || ""}`}
    />
  );
}

export function ImagePicker({
  label = "Photo",
  file,
  url,
  existingUrl,
  onFile,
  onUrl,
  onCommitUrl,
}: {
  label?: string;
  file: File | null;
  url: string;
  existingUrl?: string | null;
  onFile: (file: File | null) => void;
  onUrl: (url: string) => void;
  onCommitUrl?: (url: string) => void;
}) {
  const inputId = useId();
  const [mode, setMode] = useState<"file" | "url">(url ? "url" : "file");
  const [blobUrl, setBlobUrl] = useState("");

  useEffect(() => {
    if (!file) {
      setBlobUrl("");
      return;
    }
    const next = URL.createObjectURL(file);
    setBlobUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);

  const preview = blobUrl || url.trim() || existingUrl || "";

  return (
    <div className="w-full space-y-3">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("file")}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            mode === "file" ? "bg-[#0d4f46] text-white" : "bg-muted text-muted-foreground"
          }`}
        >
          Upload file
        </button>
        <button
          type="button"
          onClick={() => setMode("url")}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            mode === "url" ? "bg-[#0d4f46] text-white" : "bg-muted text-muted-foreground"
          }`}
        >
          Image address
        </button>
      </div>
      {preview ? (
        <div className="relative overflow-hidden rounded-2xl bg-muted">
          <img src={img(preview)} alt="" className="h-40 w-full object-cover" />
          <button
            type="button"
            className="absolute right-2 top-2 rounded-full bg-white/90 p-1 shadow"
            aria-label="Remove photo"
            onClick={() => {
              onFile(null);
              onUrl("");
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}
      {mode === "file" ? (
        <label
          htmlFor={inputId}
          className="flex min-h-24 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#0d4f46]/25 bg-[#0d4f46]/5 px-4 py-5 text-center hover:border-[#0d4f46]/50"
        >
          <ImagePlus className="h-6 w-6 text-[#0d4f46]" />
          <span className="text-sm font-semibold">{file ? file.name : "Click to choose a photo"}</span>
          <span className="text-xs text-muted-foreground">JPG, PNG or WebP from your computer</span>
          <input
            id={inputId}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const next = e.target.files?.[0] || null;
              onFile(next);
              if (next) onUrl("");
            }}
          />
        </label>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-white px-3">
            <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={url}
              onChange={(e) => {
                onUrl(e.target.value);
                if (e.target.value.trim()) onFile(null);
              }}
              placeholder="https://example.com/photo.jpg"
              className="h-12 w-full bg-transparent text-sm outline-none"
            />
          </div>
          {onCommitUrl && (
            <button
              type="button"
              className="rounded-full bg-[#0d4f46] px-4 py-2 text-xs font-semibold text-white"
              onClick={() => onCommitUrl(url.trim())}
            >
              Use this address
            </button>
          )}
          <p className="text-xs text-muted-foreground">Paste a public image link. We will show it on the menu.</p>
        </div>
      )}
    </div>
  );
}

export function fileKind(source: string | File | null | undefined): "image" | "pdf" | "file" | "empty" {
  if (!source) return "empty";
  if (source instanceof File) {
    if (source.type.startsWith("image/")) return "image";
    if (source.type === "application/pdf" || /\.pdf$/i.test(source.name)) return "pdf";
    return "file";
  }
  const path = source.split("?")[0].toLowerCase();
  if (path.endsWith(".pdf")) return "pdf";
  if (/\.(jpe?g|png|webp|gif|avif|bmp|svg)$/.test(path)) return "image";
  if (/^https?:\/\//i.test(source) || source.startsWith("/uploads/")) return "image";
  return "file";
}

function displayFileName(label: string, source: string | File, kind: "image" | "pdf" | "file") {
  if (source instanceof File) return source.name;
  const raw = decodeURIComponent(source.split("?")[0].split("/").pop() || "");
  const ext = raw.includes(".") ? raw.slice(raw.lastIndexOf(".")) : kind === "pdf" ? ".pdf" : kind === "image" ? ".jpg" : "";
  if (!raw || /^[0-9a-f-]{8,}/i.test(raw)) return `${label.replace(/\s+/g, "-")}${ext}`;
  return raw;
}

export function DocViewer({
  label,
  src,
  file,
}: {
  label: string;
  src?: string | null;
  file?: File | null;
  tall?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const objectUrl = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);
  useEffect(() => () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }, [objectUrl]);
  const href = objectUrl || src || "";
  const kind = fileKind(file || src);
  const name = href && kind !== "empty" ? displayFileName(label, file || src || href, kind) : "";

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (kind === "empty" || !href) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/40 px-4 py-3">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <p className="mt-1 text-sm text-muted-foreground">No document yet</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-[#0d4f46]/5 p-3">
        {kind === "image" ? (
          <button type="button" className="shrink-0" onClick={() => setOpen(true)}>
            <img src={href} alt="" className="h-12 w-12 rounded-xl object-cover" />
          </button>
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0d4f46] text-white">
            <FileText className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-muted-foreground">{label}</p>
          <button
            type="button"
            className="block max-w-full truncate text-left text-sm font-bold text-[#0d4f46] underline decoration-[#0d4f46]/30 underline-offset-2 hover:decoration-[#0d4f46]"
            onClick={() => setOpen(true)}
          >
            {name}
          </button>
          <p className="text-[11px] text-muted-foreground">
            {kind === "pdf" ? "PDF" : kind === "image" ? "Image" : "File"} · Click the name to open
          </p>
        </div>
      </div>
      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-3 sm:p-8"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative flex h-[min(92vh,880px)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted-foreground">{label}</p>
                <p className="truncate font-bold">{name}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  New tab
                </a>
                <button
                  type="button"
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
                  aria-label="Close document"
                  onClick={() => setOpen(false)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 bg-[#111]">
              {kind === "image" ? (
                <img src={href} alt={label} className="h-full w-full object-contain" />
              ) : (
                <iframe title={name} src={`${href}#view=FitH`} className="h-full w-full bg-white" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const lineControl =
  "h-11 w-full border-0 border-b border-black/15 bg-transparent px-0 text-[15px] text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary";

export function LineField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[13px] font-medium text-foreground/55">
        {label}
        {required ? <span className="text-primary">*</span> : null}
      </span>
      <div>{children}</div>
    </label>
  );
}

export function LineInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${lineControl} ${props.className || ""}`} />;
}

export type PillInputVariant = "default" | "soft" | "muted";

const pillInputVariants: Record<PillInputVariant, string> = {
  default:
    "border-border bg-white shadow-sm hover:border-primary/30 focus:border-primary focus:ring-2 focus:ring-primary/20",
  soft: "border-primary/20 bg-secondary/40 hover:border-primary/40 focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15",
  muted:
    "border-transparent bg-muted/70 hover:bg-muted focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15",
};

const pillInputSizes = {
  sm: "h-9 px-4 text-xs",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base",
};

export function pillInputStyles(
  variant: PillInputVariant = "default",
  size: keyof typeof pillInputSizes = "md",
  className?: string,
  opts?: { hasLeftIcon?: boolean; hasRightIcon?: boolean; invalid?: boolean },
) {
  return cn(
    "w-full rounded-full border font-medium text-foreground outline-none transition placeholder:text-muted-foreground/55 disabled:cursor-not-allowed disabled:opacity-50",
    pillInputSizes[size],
    pillInputVariants[variant],
    opts?.hasLeftIcon && "pl-11",
    opts?.hasRightIcon && "pr-11",
    opts?.invalid && "border-destructive focus:border-destructive focus:ring-destructive/20",
    className,
  );
}

export function PillInput({
  variant = "default",
  inputSize = "md",
  icon,
  iconRight,
  error,
  hint,
  wrapperClassName,
  className,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & {
  variant?: PillInputVariant;
  inputSize?: keyof typeof pillInputSizes;
  icon?: ReactNode;
  iconRight?: ReactNode;
  error?: string;
  hint?: string;
  wrapperClassName?: string;
}) {
  const invalid = Boolean(error || props["aria-invalid"]);
  return (
    <div className={cn("w-full", wrapperClassName)}>
      <div className="relative">
        {icon ? (
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-primary/70">
            {icon}
          </span>
        ) : null}
        <input
          {...props}
          aria-invalid={invalid || undefined}
          className={pillInputStyles(variant, inputSize, className, {
            hasLeftIcon: Boolean(icon),
            hasRightIcon: Boolean(iconRight),
            invalid,
          })}
        />
        {iconRight ? (
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
            {iconRight}
          </span>
        ) : null}
      </div>
      {error ? <p className="mt-1.5 text-xs font-semibold text-destructive">{error}</p> : null}
      {hint && !error ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function PillField({
  label,
  hint,
  required,
  error,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block w-full", className)}>
      {label ? (
        <span className="mb-1.5 block text-sm font-semibold text-foreground">
          {label}
          {required ? <span className="text-primary"> *</span> : null}
        </span>
      ) : null}
      {children}
      {error ? <p className="mt-1.5 text-xs font-semibold text-destructive">{error}</p> : null}
      {hint && !error ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
    </label>
  );
}

export function LineSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...props}
        className={`${lineControl} appearance-none pr-6 ${props.className || ""}`}
      />
      <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
        ⌄
      </span>
    </div>
  );
}

export function LineTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-24 w-full resize-y border-0 border-b border-black/15 bg-transparent px-0 py-2 text-[15px] outline-none focus:border-primary ${props.className || ""}`}
    />
  );
}

export function LineFile({
  label,
  required,
  file,
  accept,
  onChange,
}: {
  label: string;
  required?: boolean;
  file: File | null;
  accept?: string;
  onChange: (file: File | null) => void;
}) {
  return (
    <div className="space-y-3">
      <label className="block cursor-pointer">
        <span className="text-[13px] font-medium text-foreground/55">
          {label}
          {required ? <span className="text-primary">*</span> : null}
        </span>
        <span className={`${lineControl} flex items-center justify-between gap-3`}>
          <span className={file ? "truncate text-foreground" : "text-muted-foreground/70"}>
            {file ? file.name : "Choose image or PDF"}
          </span>
          <span className="text-xs text-muted-foreground">Browse</span>
        </span>
        <input
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(e) => onChange(e.target.files?.[0] || null)}
        />
      </label>
      {file ? (
        <div className="space-y-2">
          <DocViewer label="Preview" file={file} />
          <button
            type="button"
            className="text-xs font-semibold text-destructive"
            onClick={() => onChange(null)}
          >
            Remove file
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function FormStepper({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <ol className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-black/10 pb-5">
      {steps.map((label, i) => {
        const n = i + 1;
        const on = n <= current;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                on ? "bg-primary text-white" : "bg-[#d9dce3] text-white"
              }`}
            >
              {n}
            </span>
            <span className={`text-sm font-medium ${n === current ? "text-primary" : "text-muted-foreground"}`}>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function FormShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-3xl font-extrabold tracking-tight text-foreground md:text-[2.1rem]">{title}</h1>
      {children}
    </div>
  );
}

export function Empty({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <Card className="py-12 text-center">
      <p className="text-lg font-bold">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </Card>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return <p className="py-10 text-center text-sm text-muted-foreground">{label}</p>;
}

export function Price({ value }: { value: number }) {
  return <span className="font-bold tabular-nums">{frw(value)}</span>;
}

export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [locked]);
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "destructive",
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "destructive" | "primary";
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}) {
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#0f172a]/55 backdrop-blur-[2px]"
        aria-label="Close dialog"
        onClick={() => !loading && onCancel()}
      />
      <div className="relative flex max-h-[min(90dvh,calc(100dvh-2rem))] w-full max-w-md flex-col overflow-y-auto rounded-[1.5rem] border border-black/5 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.22)] sm:p-6">
        <div className="flex gap-4">
          <span
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
              variant === "destructive" ? "bg-red-50 text-red-600" : "bg-primary/10 text-primary"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6" aria-hidden>
              <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="confirm-dialog-title" className="text-lg font-extrabold text-[#1e293b]">
              {title}
            </h2>
            <div className="mt-2 text-sm leading-relaxed text-[#64748b]">{description}</div>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Btn variant="outline" size="sm" disabled={loading} onClick={onCancel}>
            {cancelLabel}
          </Btn>
          <Btn
            variant={variant === "destructive" ? "destructive" : "primary"}
            size="sm"
            disabled={loading}
            onClick={() => void onConfirm()}
          >
            {loading ? "Please wait…" : confirmLabel}
          </Btn>
        </div>
      </div>
    </div>
  );
}
