import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { bumpCatalog, refreshSettings } from "../catalog";
import {
  DEFAULT_SHIPPING_SECTIONS,
  parseShippingSections,
  shippingDefaultsRecord,
  shippingFromSettings,
  type ShippingSection,
} from "../shippingContent";
import { Btn, Card, Field, Input, Textarea } from "../ui";
import { AdminGuide } from "./AdminUi";

const ICON_OPTIONS = [
  { id: "clock", label: "Clock" },
  { id: "bike", label: "Delivery" },
  { id: "map", label: "Map" },
  { id: "store", label: "Store" },
  { id: "wallet", label: "Wallet" },
  { id: "shield", label: "Shield" },
];

function ShippingPreview({ settings }: { settings: Record<string, string> }) {
  const shipping = shippingFromSettings(settings);
  return (
    <Card className="overflow-hidden rounded-[1.5rem] border-2 border-[#0d4f46]/15 p-0">
      <div className="border-b border-border bg-[#0d4f46]/5 px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#0d4f46]">
        Live preview
      </div>
      <div className="bg-[#1f1f1f] p-4 text-white">
        <p className="text-[10px] font-bold uppercase tracking-wide text-primary">{shipping.eyebrow}</p>
        <p className="mt-2 text-lg font-extrabold">
          {shipping.title} <span className="font-serif italic text-primary">{shipping.highlight}</span>
        </p>
        <p className="mt-2 text-xs text-white/75">{shipping.intro}</p>
      </div>
      <div className="grid gap-2 p-3 sm:grid-cols-2">
        {shipping.sections.slice(0, 4).map((section) => (
          <div key={section.title} className="rounded-xl border border-border bg-muted/20 p-3 text-xs">
            <p className="font-bold">{section.title}</p>
            <p className="mt-1 line-clamp-3 text-muted-foreground">{section.body}</p>
          </div>
        ))}
      </div>
      {shipping.showZones ? (
        <p className="border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
          Delivery zone table shown on live page
        </p>
      ) : null}
    </Card>
  );
}

export function AdminShipping() {
  const [s, setS] = useState<Record<string, string>>({});
  const [sections, setSections] = useState<ShippingSection[]>(DEFAULT_SHIPPING_SECTIONS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<Record<string, string>>("/api/settings")
      .then((data) => {
        const merged = { ...shippingDefaultsRecord(), ...data };
        setS(merged);
        setSections(parseShippingSections(merged.shippingSections));
      })
      .catch((e) => toast.error(e.message));
  }, []);

  const previewSettings = useMemo(
    () => ({
      ...s,
      shippingSections: JSON.stringify(sections.filter((row) => row.title.trim())),
    }),
    [s, sections],
  );

  function patch(key: string, value: string) {
    setS((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const body: Record<string, string> = {
        ...s,
        shippingSections: JSON.stringify(sections.filter((row) => row.title.trim())),
      };
      await api("/api/admin/settings", { method: "PUT", json: body });
      bumpCatalog();
      await refreshSettings();
      toast.success("Shipping page saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  function resetDefaults() {
    const defaults = shippingDefaultsRecord();
    setS(defaults);
    setSections(parseShippingSections(defaults.shippingSections));
    toast.message("Reset to defaults — click Save to apply");
  }

  return (
    <div className="space-y-6">
      <AdminGuide>
        <p className="font-bold">Shipping & delivery page</p>
        <p className="mt-1 text-muted-foreground">
          Edit content on <strong>/shipping</strong>. The fee table uses live data from Delivery areas. Use{" "}
          {"{{name}}"} and {"{{delivery}}"} in text fields.
        </p>
      </AdminGuide>
      <div className="flex flex-wrap items-center gap-3">
        <Btn onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save shipping page"}
        </Btn>
        <Btn variant="ghost" onClick={resetDefaults}>
          Reset defaults
        </Btn>
        <Link href="/shipping" className="text-sm font-semibold text-[#0d4f46] underline">
          View live page →
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card className="space-y-4 rounded-[1.5rem] p-6">
            <h2 className="text-lg font-bold">Page header</h2>
            <Field label="Eyebrow">
              <Input value={s.shippingEyebrow || ""} onChange={(e) => patch("shippingEyebrow", e.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title line">
                <Input value={s.shippingTitle || ""} onChange={(e) => patch("shippingTitle", e.target.value)} />
              </Field>
              <Field label="Highlighted word">
                <Input value={s.shippingHighlight || ""} onChange={(e) => patch("shippingHighlight", e.target.value)} />
              </Field>
            </div>
            <Field label="Intro">
              <Textarea value={s.shippingIntro || ""} onChange={(e) => patch("shippingIntro", e.target.value)} className="min-h-24" />
            </Field>
          </Card>

          <Card className="space-y-4 rounded-[1.5rem] p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-bold">Delivery zones table</h2>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={s.shippingShowZones !== "false"}
                  onChange={(e) => patch("shippingShowZones", e.target.checked ? "true" : "false")}
                />
                Show on page
              </label>
            </div>
            <Field label="Table title">
              <Input value={s.shippingZonesTitle || ""} onChange={(e) => patch("shippingZonesTitle", e.target.value)} />
            </Field>
            <Field label="Table intro">
              <Textarea value={s.shippingZonesIntro || ""} onChange={(e) => patch("shippingZonesIntro", e.target.value)} />
            </Field>
            <p className="text-xs text-muted-foreground">
              Zone names and fees are managed in{" "}
              <Link href="/admin/delivery-zones" className="font-semibold text-[#0d4f46] underline">
                Delivery areas
              </Link>
              .
            </p>
          </Card>

          <Card className="space-y-4 rounded-[1.5rem] p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Info sections</h2>
              <button
                type="button"
                className="text-sm font-semibold text-[#0d4f46] underline"
                onClick={() => setSections([...sections, { icon: "bike", title: "", body: "" }])}
              >
                + Add section
              </button>
            </div>
            <div className="space-y-4">
              {sections.map((section, index) => (
                <div key={index} className="rounded-xl border border-border bg-muted/20 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Section {index + 1}</p>
                    <button
                      type="button"
                      className="text-sm text-muted-foreground hover:text-destructive"
                      onClick={() => setSections(sections.filter((_, i) => i !== index))}
                    >
                      Remove
                    </button>
                  </div>
                  <Field label="Icon">
                    <select
                      value={section.icon}
                      onChange={(e) =>
                        setSections(sections.map((row, i) => (i === index ? { ...row, icon: e.target.value } : row)))
                      }
                      className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                    >
                      {ICON_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Title">
                    <Input
                      value={section.title}
                      onChange={(e) =>
                        setSections(sections.map((row, i) => (i === index ? { ...row, title: e.target.value } : row)))
                      }
                    />
                  </Field>
                  <Field label="Body">
                    <Textarea
                      value={section.body}
                      onChange={(e) =>
                        setSections(sections.map((row, i) => (i === index ? { ...row, body: e.target.value } : row)))
                      }
                      className="min-h-20"
                    />
                  </Field>
                </div>
              ))}
            </div>
          </Card>

          <Card className="space-y-4 rounded-[1.5rem] p-6">
            <h2 className="text-lg font-bold">Contact strip</h2>
            <Field label="Title">
              <Input value={s.shippingContactTitle || ""} onChange={(e) => patch("shippingContactTitle", e.target.value)} />
            </Field>
            <Field label="Body">
              <Textarea value={s.shippingContactBody || ""} onChange={(e) => patch("shippingContactBody", e.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Button label">
                <Input value={s.shippingContactButton || ""} onChange={(e) => patch("shippingContactButton", e.target.value)} />
              </Field>
              <Field label="Button link">
                <Input value={s.shippingContactHref || ""} onChange={(e) => patch("shippingContactHref", e.target.value)} />
              </Field>
            </div>
          </Card>
        </div>
        <ShippingPreview settings={previewSettings} />
      </div>
    </div>
  );
}
