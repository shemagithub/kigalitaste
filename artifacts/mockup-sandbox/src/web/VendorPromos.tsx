import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Percent, Plus, Trash2 } from "lucide-react";
import { api, frw } from "@/lib/api";
import { Btn, Card, ConfirmDialog, Empty, Field, Input, Textarea } from "./ui";

type PromoRow = {
  id: number;
  code: string;
  description: string;
  discountType: "PERCENT" | "FIXED" | "BOGO";
  discountValue: number;
  buyQty: number;
  getQty: number;
  minSubtotal: number;
  maxDiscount: number | null;
  firstOrderOnly: boolean;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
};

type PromoDraft = {
  code: string;
  description: string;
  discountType: "PERCENT" | "FIXED" | "BOGO";
  discountValue: string;
  buyQty: string;
  getQty: string;
  minSubtotal: string;
  maxDiscount: string;
  firstOrderOnly: boolean;
  usageLimit: string;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
};

const emptyDraft = (): PromoDraft => ({
  code: "",
  description: "",
  discountType: "BOGO",
  discountValue: "10",
  buyQty: "1",
  getQty: "1",
  minSubtotal: "0",
  maxDiscount: "",
  firstOrderOnly: false,
  usageLimit: "",
  isActive: true,
  startsAt: "",
  endsAt: "",
});

function toDraft(row: PromoRow): PromoDraft {
  return {
    code: row.code,
    description: row.description || "",
    discountType: row.discountType,
    discountValue: String(row.discountValue),
    buyQty: String(row.buyQty || 1),
    getQty: String(row.getQty || 1),
    minSubtotal: String(row.minSubtotal || 0),
    maxDiscount: row.maxDiscount != null ? String(row.maxDiscount) : "",
    firstOrderOnly: row.firstOrderOnly,
    usageLimit: row.usageLimit != null ? String(row.usageLimit) : "",
    isActive: row.isActive,
    startsAt: row.startsAt ? row.startsAt.slice(0, 16) : "",
    endsAt: row.endsAt ? row.endsAt.slice(0, 16) : "",
  };
}

function toPayload(draft: PromoDraft) {
  return {
    code: draft.code.trim().toUpperCase(),
    description: draft.description.trim(),
    discountType: draft.discountType,
    discountValue: draft.discountType === "BOGO" ? 0 : Number(draft.discountValue) || 0,
    buyQty: Number(draft.buyQty) || 1,
    getQty: Number(draft.getQty) || 1,
    minSubtotal: Number(draft.minSubtotal) || 0,
    maxDiscount: draft.maxDiscount.trim() === "" ? null : Number(draft.maxDiscount) || 0,
    firstOrderOnly: draft.firstOrderOnly,
    usageLimit: draft.usageLimit.trim() === "" ? null : Number(draft.usageLimit) || 1,
    isActive: draft.isActive,
    startsAt: draft.startsAt ? new Date(draft.startsAt).toISOString() : null,
    endsAt: draft.endsAt ? new Date(draft.endsAt).toISOString() : null,
  };
}

function discountLabel(row: PromoRow) {
  if (row.discountType === "BOGO") return `Buy ${row.buyQty || 1} Get ${row.getQty || 1} free`;
  return row.discountType === "PERCENT" ? `${row.discountValue}% off` : `${frw(row.discountValue)} off`;
}

export function VendorPromos() {
  const [rows, setRows] = useState<PromoRow[]>([]);
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<PromoDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PromoRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function reload() {
    setRows(await api<PromoRow[]>("/api/vendor/promos"));
  }

  useEffect(() => {
    reload().catch((e) => toast.error(e instanceof Error ? e.message : "Could not load promos"));
  }, []);

  const activeCount = useMemo(() => rows.filter((r) => r.isActive).length, [rows]);

  async function save() {
    setSaving(true);
    try {
      const body = toPayload(draft);
      if (editingId === "new") {
        await api("/api/vendor/promos", { method: "POST", json: body });
        toast.success(`${body.code} created — customers will see it on your Promo tab`);
      } else if (typeof editingId === "number") {
        await api(`/api/vendor/promos/${editingId}`, { method: "PUT", json: body });
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
      await api(`/api/vendor/promos/${deleteTarget.id}`, { method: "DELETE" });
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
      await api(`/api/vendor/promos/${row.id}`, {
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
              Remove <span className="font-bold">{deleteTarget.code}</span> from your kitchen offers.
            </p>
          ) : null
        }
        confirmLabel="Delete promo"
        cancelLabel="Keep"
        loading={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />

      <Card className="space-y-2 bg-[#0d4f46]/[0.04]">
        <p className="font-bold text-[#0d4f46]">Kitchen promos</p>
        <p className="text-sm text-muted-foreground">
          Create Buy 1 Get 1 (or Buy X Get Y), percent, or fixed offers for your menu. BOGO makes the cheapest items free
          — you fund the free dish base price. Codes appear on your restaurant Promo tab and work at checkout when
          customers order from you.
        </p>
        <p className="text-sm text-muted-foreground">
          Active: {activeCount} · All: {rows.length}
        </p>
      </Card>

      <div className="flex justify-end">
        <Btn
          size="sm"
          onClick={() => {
            setEditingId("new");
            setDraft(emptyDraft());
          }}
        >
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
                placeholder="B1G1"
              />
            </Field>
            <Field label="Type">
              <select
                className="h-11 w-full rounded-2xl border border-border bg-white px-3 text-sm"
                value={draft.discountType}
                onChange={(e) => {
                  const discountType =
                    e.target.value === "FIXED" ? "FIXED" : e.target.value === "BOGO" ? "BOGO" : "PERCENT";
                  setDraft((d) => ({ ...d, discountType }));
                }}
              >
                <option value="BOGO">Buy X Get Y free</option>
                <option value="PERCENT">Percent off</option>
                <option value="FIXED">Fixed FRw off</option>
              </select>
            </Field>
            {draft.discountType === "BOGO" ? (
              <>
                <Field label="Buy">
                  <Input
                    className="h-11 rounded-2xl"
                    type="number"
                    min={1}
                    max={20}
                    value={draft.buyQty}
                    onChange={(e) => setDraft((d) => ({ ...d, buyQty: e.target.value }))}
                  />
                </Field>
                <Field label="Get free">
                  <Input
                    className="h-11 rounded-2xl"
                    type="number"
                    min={1}
                    max={20}
                    value={draft.getQty}
                    onChange={(e) => setDraft((d) => ({ ...d, getQty: e.target.value }))}
                  />
                </Field>
              </>
            ) : (
              <Field label={draft.discountType === "PERCENT" ? "Percent" : "Amount (FRw)"}>
                <Input
                  className="h-11 rounded-2xl"
                  type="number"
                  min={1}
                  value={draft.discountValue}
                  onChange={(e) => setDraft((d) => ({ ...d, discountValue: e.target.value }))}
                />
              </Field>
            )}
            <Field label="Minimum food total (FRw)">
              <Input
                className="h-11 rounded-2xl"
                type="number"
                min={0}
                value={draft.minSubtotal}
                onChange={(e) => setDraft((d) => ({ ...d, minSubtotal: e.target.value }))}
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
          </div>
          <Field label="Description">
            <Textarea
              className="min-h-20 rounded-2xl"
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              placeholder="Buy 1 get 1 free on our menu"
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
              Active
            </label>
          </div>
          {draft.discountType === "BOGO" ? (
            <p className="rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">
              Example: Buy {draft.buyQty || 1} Get {draft.getQty || 1} — with{" "}
              {(Number(draft.buyQty) || 1) + (Number(draft.getQty) || 1)} items in the cart,{" "}
              {draft.getQty || 1} cheapest item(s) become free.
            </p>
          ) : null}
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

      {rows.length === 0 && editingId == null ? (
        <Empty
          title="No kitchen promos yet"
          body="Create Buy 1 Get 1 or another offer so customers see it on your restaurant Promo tab."
        />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <Card key={row.id} className="space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-extrabold tracking-wide text-[#0d4f46]">{row.code}</p>
                  <p className="text-sm text-muted-foreground">
                    {discountLabel(row)}
                    {row.minSubtotal > 0 ? ` · min ${frw(row.minSubtotal)}` : ""}
                    {!row.isActive ? " · off" : ""}
                  </p>
                  {row.description ? <p className="mt-1 text-sm">{row.description}</p> : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Used {row.usedCount}
                    {row.usageLimit != null ? ` / ${row.usageLimit}` : ""} times
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Btn variant="outline" size="sm" onClick={() => { setEditingId(row.id); setDraft(toDraft(row)); }}>
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
