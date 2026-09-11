import { useEffect, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { api, img } from "@/lib/api";
import { bumpCatalog } from "../catalog";
import { Btn, Card, Empty } from "../ui";
import { AdminGuide, StatusChip } from "./AdminUi";

type RestaurantRow = {
  id: number;
  name: string;
  slug: string;
  type: string;
  address: string;
  phone: string;
  isLive: number;
  isOpen: number;
  openingHours: string;
  logoUrl: string | null;
  businessName: string;
  vendorStatus: string;
  suspended: number;
  menuCount: number;
  orderCount: number;
};

export function AdminRestaurants() {
  const [rows, setRows] = useState<RestaurantRow[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "live" | "offline">("all");

  async function reload() {
    setRows(await api<RestaurantRow[]>("/api/admin/restaurants"));
  }

  useEffect(() => {
    reload().catch((e) => toast.error(e.message));
  }, []);

  async function setVisibility(row: RestaurantRow, patch: { isLive?: boolean; isOpen?: boolean }) {
    if (busyId) return;
    setBusyId(row.id);
    try {
      const data = await api<{ restaurant: RestaurantRow }>(`/api/admin/restaurants/${row.id}/visibility`, {
        method: "POST",
        json: patch,
      });
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...data.restaurant } : r)));
      bumpCatalog();
      if (patch.isLive === true) toast.success(`${row.name} is now live on the site`);
      else if (patch.isLive === false) toast.success(`${row.name} is offline — hidden from customers`);
      else if (patch.isOpen === true) toast.success(`${row.name} is open for orders`);
      else if (patch.isOpen === false) toast.success(`${row.name} is marked closed`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  const live = rows.filter((r) => r.isLive && !r.suspended).length;
  const offline = rows.filter((r) => !r.isLive || r.suspended).length;
  const visible = rows.filter((r) => {
    if (filter === "live") return Boolean(r.isLive) && !r.suspended;
    if (filter === "offline") return !r.isLive || Boolean(r.suspended);
    return true;
  });

  return (
    <div className="space-y-5">
      <AdminGuide>
        <p className="font-bold">Restaurant control</p>
        <p className="mt-1 text-muted-foreground">
          Put a kitchen <strong>Live</strong> so customers can find it, or <strong>Offline</strong> to hide it from the
          site. Open/Closed only changes whether it accepts orders while it is live. Suspended vendors stay hidden until
          you unsuspend them.
        </p>
      </AdminGuide>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total kitchens</p>
          <p className="mt-2 text-2xl font-extrabold text-[#0d4f46]">{rows.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live on site</p>
          <p className="mt-2 text-2xl font-extrabold text-[#0d4f46]">{live}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Offline</p>
          <p className="mt-2 text-2xl font-extrabold text-[#0d4f46]">{offline}</p>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: "all", label: `All (${rows.length})` },
            { id: "live", label: `Live (${live})` },
            { id: "offline", label: `Offline (${offline})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              filter === tab.id ? "bg-[#0d4f46] text-white" : "bg-white text-[#0d4f46] shadow-card"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <Empty title="No restaurants" body="Nothing in this filter. Approved vendors appear here after onboarding." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visible.map((r) => {
            const shownLive = Boolean(r.isLive) && !r.suspended;
            const busy = busyId === r.id;
            const canGoLive = r.vendorStatus === "APPROVED" && !r.suspended && r.menuCount > 0;
            return (
              <Card key={r.id} className="overflow-hidden p-0">
                <div className="flex gap-4 p-4">
                  <img
                    src={img(r.logoUrl)}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-2xl object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-[#0d4f46]">{r.name}</p>
                      {shownLive ? <StatusChip status="LIVE" /> : <StatusChip status="OFFLINE" />}
                      {r.suspended ? <StatusChip status="SUSPENDED" /> : null}
                      {shownLive ? (
                        r.isOpen ? <StatusChip status="OPEN" /> : <StatusChip status="CLOSED" />
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {r.type} · {r.businessName}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{r.address}</p>
                    <p className="mt-2 text-sm">
                      {r.menuCount} menu items · {r.orderCount} orders
                    </p>
                    {!canGoLive && !shownLive ? (
                      <p className="mt-2 text-xs text-amber-800">
                        {r.suspended
                          ? "Unsuspend the vendor before going live."
                          : r.vendorStatus !== "APPROVED"
                            ? "Approve the vendor first."
                            : "Add at least one menu item first."}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 border-t border-border bg-muted/20 px-4 py-3">
                  {shownLive ? (
                    <Btn
                      variant="destructive"
                      className="text-sm"
                      disabled={busy}
                      onClick={() => void setVisibility(r, { isLive: false })}
                    >
                      {busy ? "Saving…" : "Take offline"}
                    </Btn>
                  ) : (
                    <Btn
                      variant="panel"
                      className="text-sm"
                      disabled={busy || !canGoLive}
                      onClick={() => void setVisibility(r, { isLive: true, isOpen: true })}
                    >
                      {busy ? "Saving…" : "Put live"}
                    </Btn>
                  )}
                  {shownLive ? (
                    r.isOpen ? (
                      <Btn
                        variant="light"
                        className="text-sm text-[#0d4f46]"
                        disabled={busy}
                        onClick={() => void setVisibility(r, { isOpen: false })}
                      >
                        Mark closed
                      </Btn>
                    ) : (
                      <Btn
                        variant="light"
                        className="text-sm text-[#0d4f46]"
                        disabled={busy}
                        onClick={() => void setVisibility(r, { isOpen: true })}
                      >
                        Mark open
                      </Btn>
                    )
                  ) : null}
                  <Link href={`/r/${r.slug}`}>
                    <Btn variant="light" className="text-[#0d4f46]">
                      View on site
                    </Btn>
                  </Link>
                  <Link href={`/admin/menus?r=${r.id}`}>
                    <Btn variant="light" className="text-[#0d4f46]">
                      Manage menu
                    </Btn>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
