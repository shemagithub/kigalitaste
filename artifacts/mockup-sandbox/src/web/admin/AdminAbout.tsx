import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { bumpCatalog, refreshSettings } from "../catalog";
import {
  ABOUT_SETTING_KEYS,
  aboutDefaultsRecord,
  aboutFromSettings,
  DEFAULT_ABOUT_PRICING,
  DEFAULT_ABOUT_STATS,
  DEFAULT_ABOUT_STEPS,
  DEFAULT_CUSTOMER_BULLETS,
  DEFAULT_VENDOR_BULLETS,
  parseAboutItems,
  parseAboutStats,
  parseBulletList,
  type AboutItem,
  type AboutStat,
} from "../aboutContent";
import { Btn, Card, Field, ImagePicker, Input, Textarea } from "../ui";
import { AdminGuide } from "./AdminUi";

const ICON_OPTIONS = [
  { id: "utensils", label: "Food (utensils)" },
  { id: "bag", label: "Cart (bag)" },
  { id: "bike", label: "Delivery (bike)" },
  { id: "clock", label: "Time (clock)" },
  { id: "wallet", label: "Wallet" },
  { id: "shield", label: "Shield" },
  { id: "store", label: "Store" },
  { id: "handshake", label: "Handshake" },
];

function AboutPreview({ settings }: { settings: Record<string, string> }) {
  const about = aboutFromSettings(settings, 1);
  return (
    <Card className="overflow-hidden rounded-[1.5rem] border-2 border-[#0d4f46]/15 p-0">
      <div className="border-b border-border bg-[#0d4f46]/5 px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#0d4f46]">
        Live preview
      </div>
      <div className="grid overflow-hidden rounded-b-[1.5rem] bg-[#1f1f1f] text-white lg:grid-cols-2">
        <div className="p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-primary">{about.eyebrow}</p>
          <p className="mt-2 text-lg font-extrabold leading-tight">
            {about.titleLine1}{" "}
            <span className="font-serif italic text-primary">{about.titleHighlight}</span>
          </p>
          <p className="mt-2 text-xs text-white/75">{about.intro}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-primary px-3 py-1 text-[10px] font-semibold">{about.primaryButton}</span>
            <span className="rounded-full border border-white/30 px-3 py-1 text-[10px] font-semibold">
              {about.secondaryButton}
            </span>
          </div>
        </div>
        <img src={about.heroImage} alt="" className="h-32 w-full object-cover lg:h-full" />
      </div>
      <div className="grid gap-2 border-t border-border bg-muted/20 p-3 sm:grid-cols-3">
        {about.stats.map((stat) => (
          <div key={stat.label} className="text-center text-[10px]">
            <p className="text-muted-foreground">{stat.label}</p>
            <p className="font-bold text-primary">{stat.value}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function BulletEditor({
  bullets,
  onChange,
}: {
  bullets: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      {bullets.map((line, index) => (
        <div key={index} className="flex gap-2">
          <Input
            value={line}
            onChange={(e) => onChange(bullets.map((item, i) => (i === index ? e.target.value : item)))}
          />
          <button
            type="button"
            className="shrink-0 rounded-lg px-2 text-sm text-muted-foreground hover:bg-muted"
            onClick={() => onChange(bullets.filter((_, i) => i !== index))}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        className="text-sm font-semibold text-[#0d4f46] underline"
        onClick={() => onChange([...bullets, ""])}
      >
        + Add bullet
      </button>
    </div>
  );
}

export function AdminAbout() {
  const [s, setS] = useState<Record<string, string>>({});
  const [stats, setStats] = useState<AboutStat[]>(DEFAULT_ABOUT_STATS);
  const [pricing, setPricing] = useState<AboutItem[]>(DEFAULT_ABOUT_PRICING);
  const [steps, setSteps] = useState<AboutItem[]>(DEFAULT_ABOUT_STEPS);
  const [customerBullets, setCustomerBullets] = useState<string[]>(DEFAULT_CUSTOMER_BULLETS);
  const [vendorBullets, setVendorBullets] = useState<string[]>(DEFAULT_VENDOR_BULLETS);
  const [saving, setSaving] = useState(false);
  const [files, setFiles] = useState<Record<string, File | null>>({});

  useEffect(() => {
    api<Record<string, string>>("/api/settings")
      .then((data) => {
        const merged = { ...aboutDefaultsRecord(), ...data };
        setS(merged);
        setStats(parseAboutStats(merged.aboutStats));
        setPricing(parseAboutItems(merged.aboutPricingItems, DEFAULT_ABOUT_PRICING));
        setSteps(parseAboutItems(merged.aboutSteps, DEFAULT_ABOUT_STEPS));
        setCustomerBullets(parseBulletList(merged.aboutCustomersBullets, DEFAULT_CUSTOMER_BULLETS));
        setVendorBullets(parseBulletList(merged.aboutVendorsBullets, DEFAULT_VENDOR_BULLETS));
      })
      .catch((e) => toast.error(e.message));
  }, []);

  const previewSettings = useMemo(
    () => ({
      ...s,
      aboutStats: JSON.stringify(stats),
      aboutPricingItems: JSON.stringify(pricing),
      aboutSteps: JSON.stringify(steps),
      aboutCustomersBullets: JSON.stringify(customerBullets.filter(Boolean)),
      aboutVendorsBullets: JSON.stringify(vendorBullets.filter(Boolean)),
    }),
    [s, stats, pricing, steps, customerBullets, vendorBullets],
  );

  function patch(key: string, value: string) {
    setS((prev) => ({ ...prev, [key]: value }));
  }

  async function upload(kind: string, file: File | null) {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    form.append("kind", kind);
    const data = await api<{ url: string; key: string }>("/api/admin/settings/logo", {
      method: "POST",
      form,
    });
    patch(data.key, data.url);
    setFiles((prev) => ({ ...prev, [kind]: null }));
    toast.success("Image uploaded — save to publish");
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const payload: Record<string, string> = {
        aboutStats: JSON.stringify(stats),
        aboutPricingItems: JSON.stringify(pricing),
        aboutSteps: JSON.stringify(steps),
        aboutCustomersBullets: JSON.stringify(customerBullets.filter(Boolean)),
        aboutVendorsBullets: JSON.stringify(vendorBullets.filter(Boolean)),
      };
      for (const key of ABOUT_SETTING_KEYS) {
        if (
          key !== "aboutStats" &&
          key !== "aboutPricingItems" &&
          key !== "aboutSteps" &&
          key !== "aboutCustomersBullets" &&
          key !== "aboutVendorsBullets" &&
          s[key] != null
        ) {
          payload[key] = s[key];
        }
      }
      const data = await api<Record<string, string>>("/api/admin/settings", {
        method: "PUT",
        json: payload,
      });
      const merged = { ...aboutDefaultsRecord(), ...data };
      setS(merged);
      setStats(parseAboutStats(merged.aboutStats));
      setPricing(parseAboutItems(merged.aboutPricingItems, DEFAULT_ABOUT_PRICING));
      setSteps(parseAboutItems(merged.aboutSteps, DEFAULT_ABOUT_STEPS));
      setCustomerBullets(parseBulletList(merged.aboutCustomersBullets, DEFAULT_CUSTOMER_BULLETS));
      setVendorBullets(parseBulletList(merged.aboutVendorsBullets, DEFAULT_VENDOR_BULLETS));
      bumpCatalog();
      await refreshSettings();
      toast.success("About page updated");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function resetDefaults() {
    const defaults = aboutDefaultsRecord();
    setS((prev) => ({ ...prev, ...defaults }));
    setStats(parseAboutStats(defaults.aboutStats));
    setPricing(parseAboutItems(defaults.aboutPricingItems, DEFAULT_ABOUT_PRICING));
    setSteps(parseAboutItems(defaults.aboutSteps, DEFAULT_ABOUT_STEPS));
    setCustomerBullets(parseBulletList(defaults.aboutCustomersBullets, DEFAULT_CUSTOMER_BULLETS));
    setVendorBullets(parseBulletList(defaults.aboutVendorsBullets, DEFAULT_VENDOR_BULLETS));
    toast.message("Defaults loaded — save to apply on the site");
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <AdminGuide>
        <p className="font-bold">About us page</p>
        <p className="mt-1 text-muted-foreground">
          Edit the public About page at <strong>/about</strong>. Use {"{{name}}"} for the platform name,{" "}
          {"{{delivery}}"} for the delivery-from price, and {"{{kitchens}}"} for the live restaurant count.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Terms & trust section still uses the text from Admin → Settings.
        </p>
      </AdminGuide>

      <AboutPreview settings={previewSettings} />

      <Card className="space-y-4 p-6">
        <h2 className="font-bold text-[#0d4f46]">Hero banner</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Eyebrow label">
            <Input value={s.aboutEyebrow || ""} onChange={(e) => patch("aboutEyebrow", e.target.value)} />
          </Field>
          <Field label="Title line 1">
            <Input value={s.aboutTitleLine1 || ""} onChange={(e) => patch("aboutTitleLine1", e.target.value)} />
          </Field>
          <Field label="Title highlight (orange italic)">
            <Input value={s.aboutTitleHighlight || ""} onChange={(e) => patch("aboutTitleHighlight", e.target.value)} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Intro paragraph">
              <Textarea
                className="min-h-24"
                value={s.aboutIntro || ""}
                onChange={(e) => patch("aboutIntro", e.target.value)}
              />
            </Field>
          </div>
          <Field label="Primary button">
            <Input value={s.aboutPrimaryButton || ""} onChange={(e) => patch("aboutPrimaryButton", e.target.value)} />
          </Field>
          <Field label="Primary link">
            <Input value={s.aboutPrimaryHref || ""} onChange={(e) => patch("aboutPrimaryHref", e.target.value)} />
          </Field>
          <Field label="Secondary button">
            <Input
              value={s.aboutSecondaryButton || ""}
              onChange={(e) => patch("aboutSecondaryButton", e.target.value)}
            />
          </Field>
          <Field label="Secondary link">
            <Input value={s.aboutSecondaryHref || ""} onChange={(e) => patch("aboutSecondaryHref", e.target.value)} />
          </Field>
        </div>
        <ImagePicker
          label="Hero photo (right side)"
          file={files.aboutHero || null}
          url=""
          existingUrl={s.aboutHeroImageUrl}
          onFile={(file) => {
            setFiles((prev) => ({ ...prev, aboutHero: file }));
            void upload("aboutHero", file);
          }}
          onUrl={() => {}}
          onCommitUrl={(url) => patch("aboutHeroImageUrl", url)}
        />
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="font-bold text-[#0d4f46]">Stat cards (3)</h2>
        {stats.map((row, index) => (
          <div key={index} className="grid gap-3 rounded-2xl bg-muted/30 p-4 md:grid-cols-3">
            <Field label="Label">
              <Input
                value={row.label}
                onChange={(e) =>
                  setStats((prev) => prev.map((item, i) => (i === index ? { ...item, label: e.target.value } : item)))
                }
              />
            </Field>
            <Field label="Value (use {{kitchens}} or {{delivery}})">
              <Input
                value={row.value}
                onChange={(e) =>
                  setStats((prev) => prev.map((item, i) => (i === index ? { ...item, value: e.target.value } : item)))
                }
              />
            </Field>
            <Field label="Hint">
              <Input
                value={row.hint}
                onChange={(e) =>
                  setStats((prev) => prev.map((item, i) => (i === index ? { ...item, hint: e.target.value } : item)))
                }
              />
            </Field>
          </div>
        ))}
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="font-bold text-[#0d4f46]">What is {s.platformName || "Kigali Taste"}?</h2>
        <Field label="Section title">
          <Input value={s.aboutWhatTitle || ""} onChange={(e) => patch("aboutWhatTitle", e.target.value)} />
        </Field>
        <Field label="Paragraph 1">
          <Textarea
            className="min-h-24"
            value={s.aboutWhatParagraph1 || ""}
            onChange={(e) => patch("aboutWhatParagraph1", e.target.value)}
          />
        </Field>
        <Field label="Paragraph 2">
          <Textarea
            className="min-h-24"
            value={s.aboutWhatParagraph2 || ""}
            onChange={(e) => patch("aboutWhatParagraph2", e.target.value)}
          />
        </Field>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="font-bold text-[#0d4f46]">How pricing works</h2>
        <Field label="Card title">
          <Input value={s.aboutPricingTitle || ""} onChange={(e) => patch("aboutPricingTitle", e.target.value)} />
        </Field>
        {pricing.map((row, index) => (
          <div key={index} className="grid gap-3 rounded-2xl bg-muted/30 p-4 md:grid-cols-4">
            <Field label="Icon">
              <select
                className="h-11 w-full rounded-xl border px-3"
                value={row.icon}
                onChange={(e) =>
                  setPricing((prev) =>
                    prev.map((item, i) => (i === index ? { ...item, icon: e.target.value } : item)),
                  )
                }
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
                value={row.title}
                onChange={(e) =>
                  setPricing((prev) =>
                    prev.map((item, i) => (i === index ? { ...item, title: e.target.value } : item)),
                  )
                }
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="Description">
                <Input
                  value={row.body}
                  onChange={(e) =>
                    setPricing((prev) =>
                      prev.map((item, i) => (i === index ? { ...item, body: e.target.value } : item)),
                    )
                  }
                />
              </Field>
            </div>
          </div>
        ))}
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="font-bold text-[#0d4f46]">How it works (4 steps)</h2>
        {steps.map((row, index) => (
          <div key={index} className="grid gap-3 rounded-2xl bg-muted/30 p-4 md:grid-cols-4">
            <Field label="Icon">
              <select
                className="h-11 w-full rounded-xl border px-3"
                value={row.icon}
                onChange={(e) =>
                  setSteps((prev) => prev.map((item, i) => (i === index ? { ...item, icon: e.target.value } : item)))
                }
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
                value={row.title}
                onChange={(e) =>
                  setSteps((prev) => prev.map((item, i) => (i === index ? { ...item, title: e.target.value } : item)))
                }
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="Description">
                <Input
                  value={row.body}
                  onChange={(e) =>
                    setSteps((prev) => prev.map((item, i) => (i === index ? { ...item, body: e.target.value } : item)))
                  }
                />
              </Field>
            </div>
          </div>
        ))}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4 p-6">
          <h2 className="font-bold text-[#0d4f46]">For customers</h2>
          <Field label="Title">
            <Input value={s.aboutCustomersTitle || ""} onChange={(e) => patch("aboutCustomersTitle", e.target.value)} />
          </Field>
          <Field label="Bullet points">
            <BulletEditor bullets={customerBullets} onChange={setCustomerBullets} />
          </Field>
          <Field label="Button label">
            <Input
              value={s.aboutCustomersButton || ""}
              onChange={(e) => patch("aboutCustomersButton", e.target.value)}
            />
          </Field>
          <Field label="Button link">
            <Input value={s.aboutCustomersHref || ""} onChange={(e) => patch("aboutCustomersHref", e.target.value)} />
          </Field>
        </Card>

        <Card className="space-y-4 p-6">
          <h2 className="font-bold text-[#0d4f46]">For restaurants</h2>
          <Field label="Title">
            <Input value={s.aboutVendorsTitle || ""} onChange={(e) => patch("aboutVendorsTitle", e.target.value)} />
          </Field>
          <Field label="Bullet points">
            <BulletEditor bullets={vendorBullets} onChange={setVendorBullets} />
          </Field>
          <Field label="Button label">
            <Input value={s.aboutVendorsButton || ""} onChange={(e) => patch("aboutVendorsButton", e.target.value)} />
          </Field>
          <Field label="Button link">
            <Input value={s.aboutVendorsHref || ""} onChange={(e) => patch("aboutVendorsHref", e.target.value)} />
          </Field>
        </Card>
      </div>

      <Card className="space-y-4 p-6">
        <h2 className="font-bold text-[#0d4f46]">Contact strip (bottom)</h2>
        <Field label="Heading">
          <Input value={s.aboutContactTitle || ""} onChange={(e) => patch("aboutContactTitle", e.target.value)} />
        </Field>
        <Field label="Description">
          <Textarea
            className="min-h-20"
            value={s.aboutContactBody || ""}
            onChange={(e) => patch("aboutContactBody", e.target.value)}
          />
        </Field>
        <p className="text-xs text-muted-foreground">
          Phone, email, and address come from Admin → Settings. The Send a message button links to /contact.
        </p>
      </Card>

      <div className="sticky bottom-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-card">
        <div className="flex flex-wrap gap-2">
          <Link href="/about" className="text-sm font-semibold text-[#0d4f46] underline">
            View About page
          </Link>
          <button type="button" className="text-sm text-muted-foreground underline" onClick={resetDefaults}>
            Reset to defaults
          </button>
        </div>
        <Btn onClick={() => void save()} disabled={saving} className="min-w-36">
          {saving ? "Saving…" : "Save About page"}
        </Btn>
      </div>
    </div>
  );
}
