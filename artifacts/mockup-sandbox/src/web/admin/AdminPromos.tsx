import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Percent, Plus, Trash2 } from "lucide-react";
import { api, frw } from "@/lib/api";
import { Btn, Card, ConfirmDialog, Empty, Field, Input, Textarea } from "../ui";
import { AdminGuide, AdminMetric, FilterTabs, StatusChip } from "./AdminUi";

type PromoRow = {
  id: number;
  code: string;
  description: string;
  discountType: "PERCENT" | "FIXED";
  discountValue: number;
  minSubtotal: number;
  maxDiscount: number | null;
  firstOrderOnly: boolean;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
  restaurantId: number | null;
  restaurantName?: string | null;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
};

type PromoDraft = {
  code: string;
  description: string;
  discountType: "PERCENT" | "FIXED";
  discountValue: string;
  minSubtotal: string;
  maxDiscount: string;
  firstOrderOnly: boolean;
  usageLimit: string;
  isActive: boolean;
  restaurantId: string;
  startsAt: string;
  endsAt: string;
};

type RestaurantOption = { id: number; name: string };

const emptyDraft = (): PromoDraft => ({
  code: "",
  description: "",
  discountType: "PERCENT",
  discountValue: "20",
  minSubtotal: "0",
  maxDiscount: "",
  firstOrderOnly: true,
  usageLimit: "",
  isActive: true,
  restaurantId: "",
  startsAt: "",
  endsAt: "",
});

function toDraft(row: PromoRow): PromoDraft {
  return {
    code: row.code,
    description: row.description || "",
    discountType: row.discountType,
    discountValue: String(row.discountValue),
    minSubtotal: String(row.minSubtotal || 0),
    maxDiscount: row.maxDiscount != null ? String(row.maxDiscount) : "",
    firstOrderOnly: row.firstOrderOnly,
    usageLimit: row.usageLimit != null ? String(row.usageLimit) : "",
    isActive: row.isActive,
    restaurantId: row.restaurantId != null ? String(row.restaurantId) : "",
    startsAt: row.startsAt ? row.startsAt.slice(0, 16) : "",
    endsAt: row.endsAt ? row.endsAt.slice(0, 16) : "",
  };
}

function toPayload(draft: PromoDraft) {
  return {
    code: draft.code.trim().toUpperCase(),
    description: draft.description.trim(),
    discountType: draft.discountType,
    discountValue: Number(draft.discountValue) || 0,
    minSubtotal: Number(draft.minSubtotal) || 0,
    maxDiscount: draft.maxDiscount.trim() === "" ? null : Number(draft.maxDiscount) || 0,
    firstOrderOnly: draft.firstOrderOnly,
    usageLimit: draft.usageLimit.trim() === "" ? null : Number(draft.usageLimit) || 1,
    isActive: draft.isActive,
    restaurantId: draft.restaurantId.trim() === "" ? null : Number(draft.restaurantId),
    startsAt: draft.startsAt ? new Date(draft.startsAt).toISOString() : null,
    endsAt: draft.endsAt ? new Date(draft.endsAt).toISOString() : null,
  };
}

function discountLabel(row: PromoRow) {
  return row.discountType === "PERCENT"
    ? `${row.discountValue}% off`
    : `${frw(row.discountValue)} off`;
}

export function AdminPromos() {
  const [rows, setRows] = useState<PromoRow[]>([]);
  const [restaurants, setRestaurants] = useState<RestaurantOption[]>([]);
  const [filter, setFilter] = useState("ALL");
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<PromoDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PromoRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function reload() {
    setRows(await api<PromoRow[]>("/api/admin/promos"));
  }

  useEffect(() => {
    reload().catch((e) => toast.error(e instanceof Error ? e.message : "Could not load promos"));
    api<RestaurantOption[]>("/api/admin/restaurants")
      .then((rows) => setRestaurants(rows.map((r) => ({ id: r.id, name: r.name }))))
      .catch(() => setRestaurants([]));
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filter === "ACTIVE") return r.isActive;
      if (filter === "INACTIVE") return !r.isActive;
      if (filter === "FIRST") return r.firstOrderOnly;
      if (filter === "KITCHEN") return r.restaurantId != null;
      return true;
    });
  }, [rows, filter]);

  const activeCount = rows.filter((r) => r.isActive).length;
  const redemptions = rows.reduce((s, r) => s + (Number(r.usedCount) || 0), 0);

  function startCreate() {
    setEditingId("new");
    setDraft(emptyDraft());
  }

  function startEdit(row: PromoRow) {
    setEditingId(row.id);
    setDraft(toDraft(row));
  }

  async function save() {
    setSaving(true);
    try {
      const body = toPayload(draft);
      if (editingId === "new") {
        await api("/api/admin/promos", { method: "POST", json: body });
        toast.success(`${body.code} created`);
      } else if (typeof editingId === "number") {
        await api(`/api/admin/promos/${editingId}`, { method: "PUT", json: body });
        toast.success(`${body.code} updated`);
      }
      setEditingId(null);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save promo");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api(`/api/admin/promos/${deleteTarget.id}`, { method: "DELETE" });
      toast.success(`${deleteTarget.code} deleted`);
      if (editingId === deleteTarget.id) setEditingId(null);
      setDeleteTarget(null);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
    } finally {
      setDeleting(false);
    }
  }

  async function toggleActive(row: PromoRow) {
    try {
      await api(`/api/admin/promos/${row.id}`, {
        method: "PUT",
        json: { ...row, isActive: !row.isActive },
      });
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update");
    }
  }

  return (
    <div className="space-y-4">
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete this promo?"
        description={
          deleteTarget ? (
            <p>
              Remove <span className="font-bold">{deleteTarget.code}</span>. Customers will no longer be able to use it
              at checkout.
            </p>
          ) : null
        }
        confirmLabel="Delete promo"
        cancelLabel="Keep"
        loading={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />

      <AdminGuide>
        <p className="font-bold">Promo codes</p>
        <p className="mt-1 text-muted-foreground">
          Discounts are funded from platform markup + delivery (vendors still get their menu base price). Leave restaurant
          blank for site-wide codes, or pick a kitchen so the offer only appears on that restaurant’s Promo tab and only
          works when ordering from that menu.
        </p>
      </AdminGuide>

      <div className="grid gap-4 sm:grid-cols-3">
        <AdminMetric label="Active codes" value={String(activeCount)} />
        <AdminMetric label="All codes" value={String(rows.length)} />
        <AdminMetric label="Times used" value={String(redemptions)} hint="Successful checkouts with a code" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterTabs
          active={filter}
          onChange={setFilter}
          tabs={[
            { id: "ALL", label: "All", count: rows.length },
            { id: "ACTIVE", label: "Active", count: activeCount },
            { id: "INACTIVE", label: "Off", count: rows.length - activeCount },
            { id: "KITCHEN", label: "Kitchen", count: rows.filter((r) => r.restaurantId != null).length },
            { id: "FIRST", label: "First order", count: rows.filter((r) => r.firstOrderOnly).length },
          ]}
        />
        <Btn size="sm" onClick={startCreate}>
          <Plus className="h-4 w-4" />
          New promo
        </Btn>
      </div>

      {editingId != null ? (
        <Card className="space-y-4">
          <div className="flex items-center gap-2">
            <Percent className="h-5 w-5 text-[#0d4f46]" />
            <h2 className="text-lg font-extrabold text-[#0d4f46]">
              {editingId === "new" ? "Create promo" : `Edit ${draft.code || "promo"}`}
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Code">
              <Input
                className="h-11 rounded-2xl uppercase"
                value={draft.code}
                onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value.toUpperCase() }))}
                placeholder="WELCOME20"
              />
            </Field>
            <Field label="Restaurant (optional)">
              <select
                className="h-11 w-full rounded-2xl border border-border bg-white px-3 text-sm"
                value={draft.restaurantId}
                onChange={(e) => setDraft((d) => ({ ...d, restaurantId: e.target.value }))}
              >
                <option value="">All restaurants (site-wide)</option>
                {restaurants.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Type">
              <select
                className="h-11 w-full rounded-2xl border border-border bg-white px-3 text-sm"
                value={draft.discountType}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, discountType: e.target.value === "FIXED" ? "FIXED" : "PERCENT" }))
                }
              >
                <option value="PERCENT">Percent off food</option>
                <option value="FIXED">Fixed FRw off</option>
              </select>
            </Field>
            <Field label={draft.discountType === "PERCENT" ? "Percent" : "Amount (FRw)"}>
              <Input
                className="h-11 rounded-2xl"
                type="number"
                min={1}
                value={draft.discountValue}
                onChange={(e) => setDraft((d) => ({ ...d, discountValue: e.target.value }))}
              />
            </Field>
            <Field label="Minimum food total (FRw)">
              <Input
                className="h-11 rounded-2xl"
                type="number"
                min={0}
                value={draft.minSubtotal}
                onChange={(e) => setDraft((d) => ({ ...d, minSubtotal: e.target.value }))}
              />
            </Field>
            <Field label="Max discount cap (FRw, optional)">
              <Input
                className="h-11 rounded-2xl"
                type="number"
                min={0}
                value={draft.maxDiscount}
                onChange={(e) => setDraft((d) => ({ ...d, maxDiscount: e.target.value }))}
                placeholder="No cap"
              />
            </Field>
            <Field label="Usage limit (optional)">
              <Input
                className="h-11 rounded-2xl"
                type="number"
                min={1}
                value={draft.usageLimit}
                onChange={(e) => setDraft((d) => ({ ...d, usageLimit: e.target.value }))}
                placeholder="Unlimited"
              />
            </Field>
            <Field label="Starts (optional)">
              <Input
                className="h-11 rounded-2xl"
                type="datetime-local"
                value={draft.startsAt}
                onChange={(e) => setDraft((d) => ({ ...d, startsAt: e.target.value }))}
              />
            </Field>
            <Field label="Ends (optional)">
              <Input
                className="h-11 rounded-2xl"
                type="datetime-local"
                value={draft.endsAt}
                onChange={(e) => setDraft((d) => ({ ...d, endsAt: e.target.value }))}
              />
            </Field>
          </div>
          <Field label="Description (shown in admin)">
            <Textarea
              className="min-h-20 rounded-2xl"
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              placeholder="20% off first order"
            />
          </Field>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.firstOrderOnly}
                onChange={(e) => setDraft((d) => ({ ...d, firstOrderOnly: e.target.checked }))}
              />
              First order only
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.isActive}
                onChange={(e) => setDraft((d) => ({ ...d, isActive: e.target.checked }))}
              />
              Active (customers can use it)
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Btn onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : editingId === "new" ? "Create promo" : "Save changes"}
            </Btn>
            <Btn variant="ghost" onClick={() => setEditingId(null)} disabled={saving}>
              Cancel
            </Btn>
          </div>
        </Card>
      ) : null}

      {filtered.length === 0 ? (
        <Empty title="No promo codes" body="Create WELCOME20 or another offer customers can apply at checkout." />
      ) : (
        <div className="space-y-3">
          {filtered.map((row) => (
            <Card key={row.id} className="space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-extrabold tracking-wide text-[#0d4f46]">{row.code}</p>
                  <p className="text-sm text-muted-foreground">
                    {discountLabel(row)}
                    {row.minSubtotal > 0 ? ` · min food ${frw(row.minSubtotal)}` : ""}
                    {row.firstOrderOnly ? " · first order" : ""}
                    {row.restaurantName
                      ? ` · ${row.restaurantName}`
                      : " · all restaurants"}
                  </p>
                  {row.description ? <p className="mt-1 text-sm">{row.description}</p> : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Used {row.usedCount}
                    {row.usageLimit != null ? ` / ${row.usageLimit}` : ""} times
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip status={row.isActive ? "APPROVED" : "CANCELLED"} />
                  <Btn variant="outline" size="sm" onClick={() => startEdit(row)}>
                    Edit
                  </Btn>
                  <Btn variant="ghost" size="sm" onClick={() => void toggleActive(row)}>
                    {row.isActive ? "Disable" : "Enable"}
                  </Btn>
                  <Btn variant="ghost" size="sm" onClick={() => setDeleteTarget(row)}>
                    <Trash2 className="h-4 w-4" />
                  </Btn>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
