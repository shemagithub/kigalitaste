import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { api, frw } from "@/lib/api";
import { Card, GhostBtn } from "./ui";

export type TxItem = {
  id: string;
  kind: "earning" | "payout" | "withdrawal" | "pending" | "payout_request";
  direction: "in" | "out" | "pending";
  amount: number;
  title: string;
  detail: string;
  status?: string;
  orderNumber?: string;
  restaurantName?: string;
  vendorName?: string;
  createdAt: string;
};

type TxData = {
  shopName?: string;
  earned: number;
  paidToYou?: number;
  available: number;
  paidOut: number;
  held?: number;
  pendingEarnings?: number;
  markupEarned?: number;
  deliveryEarned?: number;
  transactions: TxItem[];
};

const FILTERS = [
  ["all", "All"],
  ["earning", "Earnings"],
  ["payout", "Payouts"],
  ["pending", "Pending"],
] as const;

function fmtWhen(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-RW", { dateStyle: "medium", timeStyle: "short" });
}

function tone(item: TxItem) {
  if (item.direction === "in") return "bg-emerald-100 text-emerald-800";
  if (item.direction === "pending") return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}

function amountPrefix(item: TxItem) {
  if (item.direction === "in") return "+";
  if (item.direction === "pending") return "~";
  return "−";
}

function kindLabel(kind: TxItem["kind"]) {
  if (kind === "earning") return "Earning";
  if (kind === "pending") return "Pending";
  if (kind === "payout_request") return "Payout";
  if (kind === "withdrawal") return "Withdrawal";
  return "Payout";
}

export function TransactionsPage({ role }: { role: "vendor" | "admin" }) {
  const [data, setData] = useState<TxData | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("all");

  async function reload() {
    setData(
      await api<TxData>(role === "admin" ? "/api/admin/transactions" : "/api/vendor/transactions"),
    );
  }

  useEffect(() => {
    reload().catch((e) => toast.error(e.message));
  }, [role]);

  const rows = useMemo(() => {
    if (!data) return [];
    if (filter === "all") return data.transactions;
    if (filter === "earning") return data.transactions.filter((t) => t.kind === "earning");
    if (filter === "pending") return data.transactions.filter((t) => t.kind === "pending");
    return data.transactions.filter((t) => t.kind === "payout" || t.kind === "payout_request" || t.kind === "withdrawal");
  }, [data, filter]);

  if (!data) return <p className="text-sm text-muted-foreground">Loading transactions…</p>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0d4f46]">Transactions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {role === "admin"
              ? "Markup, delivery commission, payouts and withdrawals across Kigali Taste."
              : `All money movements for ${data.shopName || "your restaurant"}.`}
          </p>
        </div>
        <GhostBtn type="button" onClick={() => void reload()}>
          Refresh
        </GhostBtn>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(role === "admin"
          ? [
              ["Total earned", data.earned],
              ["Available", data.available],
              ["Markup", data.markupEarned ?? 0],
              ["Pending delivery", data.pendingEarnings ?? 0],
            ]
          : [
              ["Paid to you", data.paidToYou ?? data.available],
              ["Credited (delivered)", data.earned],
              ["Pending delivery", data.pendingEarnings ?? 0],
              ["Paid out", data.paidOut],
            ]
        ).map(([label, value]) => (
          <Card key={String(label)} className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-2 text-xl font-extrabold text-[#0d4f46]">{frw(Number(value))}</p>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              filter === id ? "bg-[#0d4f46] text-white" : "bg-white text-muted-foreground shadow-card"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden p-0">
        {rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            {filter === "all"
              ? role === "admin"
                ? "No platform transactions yet. Markup and delivery appear after orders are delivered."
                : "No restaurant transactions yet. Menu earnings appear after your orders are delivered."
              : `No ${filter} transactions yet.`}
          </p>
        ) : (
          <div className="divide-y divide-border">
            {rows.map((item) => (
              <div key={item.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-[#0d4f46]">{item.title}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${tone(item)}`}>
                      {kindLabel(item.kind)}
                    </span>
                    {item.status ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                        {item.status}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {fmtWhen(item.createdAt)}
                    {item.orderNumber ? ` · ${item.orderNumber}` : ""}
                    {role === "vendor" && item.restaurantName ? ` · ${item.restaurantName}` : ""}
                    {role === "admin" && item.restaurantName ? ` · ${item.restaurantName}` : ""}
                    {role === "admin" && item.vendorName ? ` · ${item.vendorName}` : ""}
                  </p>
                </div>
                <p
                  className={`text-lg font-extrabold ${
                    item.direction === "in"
                      ? "text-emerald-700"
                      : item.direction === "pending"
                        ? "text-amber-700"
                        : "text-red-700"
                  }`}
                >
                  {amountPrefix(item)}
                  {frw(item.amount)}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <p className="text-sm text-muted-foreground">
        {role === "admin" ? (
          <>
            Send commission from{" "}
            <Link href="/admin/wallet" className="font-semibold text-[#0d4f46] underline">
              Wallet & payouts
            </Link>
            .
          </>
        ) : (
          <>
            Withdraw earnings from{" "}
            <Link href="/vendor/wallet" className="font-semibold text-[#0d4f46] underline">
              Wallet
            </Link>
            .
          </>
        )}
      </p>
    </div>
  );
}
