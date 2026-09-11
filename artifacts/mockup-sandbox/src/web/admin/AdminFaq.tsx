import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { bumpCatalog, refreshSettings } from "../catalog";
import {
  DEFAULT_FAQ_ITEMS,
  faqDefaultsRecord,
  faqFromSettings,
  parseFaqItems,
  type FaqItem,
} from "../faqContent";
import { Btn, Card, Field, Input, Textarea } from "../ui";
import { AdminGuide } from "./AdminUi";

function FaqPreview({ settings }: { settings: Record<string, string> }) {
  const faq = faqFromSettings(settings);
  return (
    <Card className="overflow-hidden rounded-[1.5rem] border-2 border-[#0d4f46]/15 p-0">
      <div className="border-b border-border bg-[#0d4f46]/5 px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#0d4f46]">
        Live preview
      </div>
      <div className="bg-[#1f1f1f] p-4 text-white">
        <p className="text-[10px] font-bold uppercase tracking-wide text-primary">{faq.eyebrow}</p>
        <p className="mt-2 text-lg font-extrabold">
          {faq.title} <span className="font-serif italic text-primary">{faq.highlight}</span>
        </p>
        <p className="mt-2 text-xs text-white/75">{faq.intro}</p>
      </div>
      <div className="max-h-48 space-y-2 overflow-y-auto p-3">
        {faq.items.slice(0, 4).map((item) => (
          <div key={item.q} className="rounded-xl border border-border bg-muted/20 px-3 py-2 text-xs">
            <p className="font-bold">{item.q}</p>
            <p className="mt-1 line-clamp-2 text-muted-foreground">{item.a}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function AdminFaq() {
  const [s, setS] = useState<Record<string, string>>({});
  const [items, setItems] = useState<FaqItem[]>(DEFAULT_FAQ_ITEMS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<Record<string, string>>("/api/settings")
      .then((data) => {
        const merged = { ...faqDefaultsRecord(), ...data };
        setS(merged);
        setItems(parseFaqItems(merged.faqItems));
      })
      .catch((e) => toast.error(e.message));
  }, []);

  const previewSettings = useMemo(
    () => ({ ...s, faqItems: JSON.stringify(items.filter((item) => item.q.trim())) }),
    [s, items],
  );

  function patch(key: string, value: string) {
    setS((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const body: Record<string, string> = { ...s, faqItems: JSON.stringify(items.filter((item) => item.q.trim())) };
      await api("/api/admin/settings", { method: "PUT", json: body });
      bumpCatalog();
      await refreshSettings();
      toast.success("FAQ page saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  function resetDefaults() {
    const defaults = faqDefaultsRecord();
    setS(defaults);
    setItems(parseFaqItems(defaults.faqItems));
    toast.message("Reset to defaults — click Save to apply");
  }

  return (
    <div className="space-y-6">
      <AdminGuide>
        <p className="font-bold">FAQ page</p>
        <p className="mt-1 text-muted-foreground">
          Edit questions and answers on <strong>/faq</strong>. Use {"{{name}}"} and {"{{delivery}}"} for live values.
        </p>
      </AdminGuide>
      <div className="flex flex-wrap items-center gap-3">
        <Btn onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save FAQ page"}
        </Btn>
        <Btn variant="ghost" onClick={resetDefaults}>
          Reset defaults
        </Btn>
        <Link href="/faq" className="text-sm font-semibold text-[#0d4f46] underline">
          View live page →
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card className="space-y-4 rounded-[1.5rem] p-6">
            <h2 className="text-lg font-bold">Page header</h2>
            <Field label="Eyebrow">
              <Input value={s.faqEyebrow || ""} onChange={(e) => patch("faqEyebrow", e.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title line">
                <Input value={s.faqTitle || ""} onChange={(e) => patch("faqTitle", e.target.value)} />
              </Field>
              <Field label="Highlighted word">
                <Input value={s.faqHighlight || ""} onChange={(e) => patch("faqHighlight", e.target.value)} />
              </Field>
            </div>
            <Field label="Intro">
              <Textarea value={s.faqIntro || ""} onChange={(e) => patch("faqIntro", e.target.value)} className="min-h-24" />
            </Field>
          </Card>

          <Card className="space-y-4 rounded-[1.5rem] p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Questions & answers</h2>
              <button
                type="button"
                className="text-sm font-semibold text-[#0d4f46] underline"
                onClick={() => setItems([...items, { q: "", a: "" }])}
              >
                + Add question
              </button>
            </div>
            <div className="space-y-4">
              {items.map((item, index) => (
                <div key={index} className="rounded-xl border border-border bg-muted/20 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Q{index + 1}</p>
                    <button
                      type="button"
                      className="text-sm text-muted-foreground hover:text-destructive"
                      onClick={() => setItems(items.filter((_, i) => i !== index))}
                    >
                      Remove
                    </button>
                  </div>
                  <Field label="Question">
                    <Input
                      value={item.q}
                      onChange={(e) => setItems(items.map((row, i) => (i === index ? { ...row, q: e.target.value } : row)))}
                    />
                  </Field>
                  <Field label="Answer">
                    <Textarea
                      value={item.a}
                      onChange={(e) => setItems(items.map((row, i) => (i === index ? { ...row, a: e.target.value } : row)))}
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
              <Input value={s.faqContactTitle || ""} onChange={(e) => patch("faqContactTitle", e.target.value)} />
            </Field>
            <Field label="Body">
              <Textarea value={s.faqContactBody || ""} onChange={(e) => patch("faqContactBody", e.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Button label">
                <Input value={s.faqContactButton || ""} onChange={(e) => patch("faqContactButton", e.target.value)} />
              </Field>
              <Field label="Button link">
                <Input value={s.faqContactHref || ""} onChange={(e) => patch("faqContactHref", e.target.value)} />
              </Field>
            </div>
          </Card>
        </div>
        <FaqPreview settings={previewSettings} />
      </div>
    </div>
  );
}
