import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, frw } from "@/lib/api";
import { bumpCatalog } from "../catalog";
import { Btn, Card, Empty, Field, Input } from "../ui";
import { fetchDeliveryQuote, LocationSearch } from "../LocationSearch";
import { AdminGuide } from "./AdminUi";

type Zone = {
  id: number;
  name: string;
  keywords: string;
  fee: number;
  sort: number;
  isActive: number;
};

export function AdminDeliveryZones() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [form, setForm] = useState({ name: "", keywords: "", fee: "1500", sort: "0", isActive: true });
  const [testAddress, setTestAddress] = useState("Kacyiru, Kigali");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [editId, setEditId] = useState<number | null>(null);

  async function reload() {
    setZones(await api<Zone[]>("/api/admin/delivery-zones"));
  }

  useEffect(() => {
    reload().catch((e) => toast.error(e.message));
  }, []);

  async function saveZone() {
    if (!form.name.trim() || !form.keywords.trim()) {
      toast.error("Area name and keywords are required");
      return;
    }
    const payload = {
      name: form.name.trim(),
      keywords: form.keywords.trim(),
      fee: Number(form.fee) || 0,
      sort: Number(form.sort) || 0,
      isActive: form.isActive,
    };
    if (editId) {
      await api(`/api/admin/delivery-zones/${editId}`, { method: "PUT", json: payload });
      toast.success("Area updated");
    } else {
      await api("/api/admin/delivery-zones", { method: "POST", json: payload });
      toast.success("Area added");
    }
    setForm({ name: "", keywords: "", fee: "1500", sort: "0", isActive: true });
    setEditId(null);
    bumpCatalog();
    await reload();
  }

  return (
    <div className="space-y-5">
      <AdminGuide>
        <p className="font-bold">Delivery prices by Kigali sector</p>
        <p className="mt-1 text-muted-foreground">
          Set a fee for each area (Kimihurura, Kacyiru, Remera, etc.). Customers pick their sector at checkout and see
          the matching fee. Keywords help auto-detect the sector when they search or share GPS.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          If no sector matches, the default delivery fee from Settings is used.
        </p>
      </AdminGuide>

      <Card className="space-y-3 p-5">
        <h2 className="font-bold text-[#0d4f46]">{editId ? "Edit area" : "Add delivery area"}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Sector / area name">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Kimihurura"
            />
          </Field>
          <Field label="Delivery fee (FRw)">
            <Input value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} />
          </Field>
          <Field label="Search keywords (comma separated)">
            <Input
              value={form.keywords}
              onChange={(e) => setForm({ ...form, keywords: e.target.value })}
              placeholder="kimihurura, kibagabaga, vision city"
            />
          </Field>
          <Field label="Sort order">
            <Input value={form.sort} onChange={(e) => setForm({ ...form, sort: e.target.value })} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
          Active — show to customers at checkout
        </label>
        <div className="flex flex-wrap gap-2">
          <Btn onClick={() => void saveZone()}>{editId ? "Save changes" : "Add area"}</Btn>
          {editId ? (
            <Btn
              variant="light"
              className="text-[#0d4f46]"
              onClick={() => {
                setEditId(null);
                setForm({ name: "", keywords: "", fee: "1500", sort: "0", isActive: true });
              }}
            >
              Cancel edit
            </Btn>
          ) : null}
        </div>
      </Card>

      <Card className="space-y-3 p-5">
        <h2 className="font-bold text-[#0d4f46]">Test a customer address</h2>
        <LocationSearch
          value={testAddress}
          onChange={(pick) => setTestAddress(pick.address)}
          placeholder="Search sector or street in Kigali"
        />
        <div className="flex flex-wrap gap-2">
          <Btn
            onClick={async () => {
              const quote = await fetchDeliveryQuote(testAddress);
              if (!quote) return;
              setTestResult(
                quote.zoneName
                  ? `${quote.zoneName} → ${frw(quote.fee)}`
                  : `No sector matched → default ${frw(quote.fee)}`,
              );
            }}
          >
            Test price
          </Btn>
        </div>
        {testResult ? <p className="text-sm font-semibold text-[#0d4f46]">{testResult}</p> : null}
      </Card>

      {zones.length === 0 ? (
        <Empty title="No delivery areas" body="Add Kigali sectors above or restart the API to load defaults." />
      ) : (
        <div className="space-y-3">
          {zones.map((zone) => (
            <Card key={zone.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-bold text-[#0d4f46]">
                  {zone.name} · {frw(zone.fee)}
                </p>
                <p className="text-sm text-muted-foreground">{zone.keywords}</p>
                {!zone.isActive ? <p className="text-xs text-destructive">Inactive — hidden from checkout</p> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Btn
                  variant="light"
                  className="text-[#0d4f46]"
                  onClick={() => {
                    setEditId(zone.id);
                    setForm({
                      name: zone.name,
                      keywords: zone.keywords,
                      fee: String(zone.fee),
                      sort: String(zone.sort),
                      isActive: Boolean(zone.isActive),
                    });
                  }}
                >
                  Edit
                </Btn>
                <Btn
                  variant="destructive"
                  onClick={async () => {
                    if (!confirm(`Delete ${zone.name}?`)) return;
                    await api(`/api/admin/delivery-zones/${zone.id}`, { method: "DELETE" });
                    toast.success("Area removed");
                    bumpCatalog();
                    await reload();
                  }}
                >
                  Delete
                </Btn>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
