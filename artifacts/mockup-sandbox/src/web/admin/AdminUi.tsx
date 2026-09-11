import type { ReactNode } from "react";
import { Link } from "wouter";
import { Card } from "../ui";

export function AdminGuide({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#0d4f46]/15 bg-[#0d4f46]/5 px-4 py-4 text-sm text-[#0d4f46] sm:px-5">
      {children}
    </div>
  );
}

export function StatusChip({ status }: { status: string }) {
  const s = status.toUpperCase();
  const tone =
    s === "DELIVERED" || s === "PAID" || s === "APPROVED" || s === "SUCCESSFUL" || s === "LIVE" || s === "OPEN"
      ? "bg-emerald-100 text-emerald-800"
      : s === "CANCELLED" || s === "FAILED" || s === "REJECTED" || s === "SUSPENDED" || s === "OFFLINE" || s === "CLOSED"
        ? "bg-red-100 text-red-800"
        : s === "READY" || s === "OUT_FOR_DELIVERY" || s === "PENDING" || s === "SENDING"
          ? "bg-amber-100 text-amber-800"
          : "bg-muted text-foreground";
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${tone}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function QuickLink({
  href,
  label,
  hint,
}: {
  href: string;
  label: string;
  hint: string;
}) {
  return (
    <Link href={href} className="block rounded-2xl bg-white p-4 shadow-card transition hover:shadow-lg">
      <p className="font-bold text-[#0d4f46]">{label}</p>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
    </Link>
  );
}

export function AdminMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-extrabold text-[#0d4f46]">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}

export function FilterTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string; count?: number }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            active === tab.id ? "bg-[#0d4f46] text-white" : "bg-white text-muted-foreground shadow-card"
          }`}
        >
          {tab.label}
          {typeof tab.count === "number" ? ` (${tab.count})` : ""}
        </button>
      ))}
    </div>
  );
}
