import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Bike, Heart } from "lucide-react";
import { api } from "@/lib/api";
import { bumpCatalog, refreshSettings } from "../catalog";
import {
  DEFAULT_HERO_FEATURES,
  HERO_SETTING_KEYS,
  heroDefaultsRecord,
  heroFromSettings,
  parseHeroFeatures,
  type HeroFeature,
} from "../heroContent";
import { Btn, Card, Field, ImagePicker, Input, Textarea } from "../ui";
import { AdminGuide } from "./AdminUi";

const ICON_OPTIONS = [
  { id: "bike", label: "Delivery (bike)" },
  { id: "utensils", label: "Food (utensils)" },
  { id: "tag", label: "Prices (tag)" },
  { id: "headphones", label: "Support (headphones)" },
  { id: "percent", label: "Offers (percent)" },
];

function HeroPreview({ settings }: { settings: Record<string, string> }) {
  const hero = heroFromSettings(settings);
  return (
    <Card className="overflow-hidden rounded-[1.5rem] border-2 border-[#0d4f46]/15 p-0">
      <div className="border-b border-border bg-[#0d4f46]/5 px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#0d4f46]">
        Live preview
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-2">
        <div>
          <p className="text-lg font-extrabold leading-tight md:text-2xl">
            {hero.titleLine1}{" "}
            <span className="font-serif italic text-primary">
              {hero.titleHighlight}
              <Heart className="ml-1 inline h-4 w-4 fill-primary text-primary" />
            </span>
          </p>
          <p className="mt-2 text-xs text-muted-foreground">{hero.subtitle}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-white">
              {hero.primaryButton}
            </span>
            <span className="rounded-full border px-3 py-1.5 text-xs font-semibold">{hero.secondaryButton}</span>
          </div>
          <p className="mt-3 text-xs font-semibold">{hero.customersText}</p>
          <p className="text-[10px] text-amber-500">★★★★★ {hero.ratingText}</p>
        </div>
        <div className="relative">
          <img src={hero.mainImage} alt="" className="h-36 w-full rounded-2xl object-cover" />
          <img
            src={hero.badgeImage}
            alt=""
            className="absolute -bottom-2 left-2 h-12 w-12 rounded-full border-2 border-white object-cover shadow"
          />
          <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[10px] font-semibold shadow">
            <Bike className="h-3 w-3 text-emerald-600" />
            {hero.badgeTitle} · {hero.badgeSubtitle}
          </div>
        </div>
      </div>
      <div className="grid gap-2 border-t border-border bg-muted/20 p-3 sm:grid-cols-2 lg:grid-cols-5">
        {hero.features.map((f) => (
          <div key={f.title} className="text-[10px]">
            <p className="font-bold">{f.title}</p>
            <p className="text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function AdminHero() {
  const [s, setS] = useState<Record<string, string>>({});
  const [features, setFeatures] = useState<HeroFeature[]>(DEFAULT_HERO_FEATURES);
  const [saving, setSaving] = useState(false);
  const [files, setFiles] = useState<Record<string, File | null>>({});

  useEffect(() => {
    api<Record<string, string>>("/api/settings")
      .then((data) => {
        const merged = { ...heroDefaultsRecord(), ...data };
        setS(merged);
        setFeatures(parseHeroFeatures(merged.heroFeatures));
      })
      .catch((e) => toast.error(e.message));
  }, []);

  const previewSettings = useMemo(
    () => ({ ...s, heroFeatures: JSON.stringify(features) }),
    [s, features],
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
      const payload: Record<string, string> = { heroFeatures: JSON.stringify(features) };
      for (const key of HERO_SETTING_KEYS) {
        if (key !== "heroFeatures" && s[key] != null) payload[key] = s[key];
      }
      const data = await api<Record<string, string>>("/api/admin/settings", {
        method: "PUT",
        json: payload,
      });
      setS(data);
      setFeatures(parseHeroFeatures(data.heroFeatures));
      bumpCatalog();
      await refreshSettings();
      toast.success("Homepage hero updated");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function resetDefaults() {
    const defaults = heroDefaultsRecord();
    setS((prev) => ({ ...prev, ...defaults }));
    setFeatures(parseHeroFeatures(defaults.heroFeatures));
    toast.message("Defaults loaded — save to apply on the site");
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <AdminGuide>
        <p className="font-bold">Homepage hero</p>
        <p className="mt-1 text-muted-foreground">
          Edit the big banner customers see first on the site. Use {"{{delivery}}"} in the subtitle to insert the
          current delivery-from price automatically.
        </p>
      </AdminGuide>

      <HeroPreview settings={previewSettings} />

      <Card className="space-y-4 p-6">
        <h2 className="font-bold text-[#0d4f46]">Top announcement bar</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Left message">
            <Input value={s.topBannerText || ""} onChange={(e) => patch("topBannerText", e.target.value)} />
          </Field>
          <Field label="Center tagline">
            <Input value={s.topBannerTagline || ""} onChange={(e) => patch("topBannerTagline", e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="font-bold text-[#0d4f46]">Headline & buttons</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Title line 1">
            <Input value={s.heroTitleLine1 || ""} onChange={(e) => patch("heroTitleLine1", e.target.value)} />
          </Field>
          <Field label="Title highlight (orange italic)">
            <Input value={s.heroTitleHighlight || ""} onChange={(e) => patch("heroTitleHighlight", e.target.value)} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Subtitle">
              <Textarea
                className="min-h-24"
                value={s.heroSubtitle || ""}
                onChange={(e) => patch("heroSubtitle", e.target.value)}
              />
            </Field>
          </div>
          <Field label="Primary button label">
            <Input value={s.heroPrimaryButton || ""} onChange={(e) => patch("heroPrimaryButton", e.target.value)} />
          </Field>
          <Field label="Primary button link (empty = first restaurant)">
            <Input
              value={s.heroPrimaryHref || ""}
              onChange={(e) => patch("heroPrimaryHref", e.target.value)}
              placeholder="/menu"
            />
          </Field>
          <Field label="Secondary button label">
            <Input value={s.heroSecondaryButton || ""} onChange={(e) => patch("heroSecondaryButton", e.target.value)} />
          </Field>
          <Field label="Secondary button link">
            <Input value={s.heroSecondaryHref || ""} onChange={(e) => patch("heroSecondaryHref", e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="font-bold text-[#0d4f46]">Images</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <ImagePicker
            label="Main hero photo"
            file={files.heroMain || null}
            url=""
            existingUrl={s.heroImageUrl}
            onFile={(file) => {
              setFiles((prev) => ({ ...prev, heroMain: file }));
              void upload("heroMain", file);
            }}
            onUrl={() => {}}
            onCommitUrl={(url) => patch("heroImageUrl", url)}
          />
          <ImagePicker
            label="Small circle photo (bottom left)"
            file={files.heroBadge || null}
            url=""
            existingUrl={s.heroBadgeImageUrl}
            onFile={(file) => {
              setFiles((prev) => ({ ...prev, heroBadge: file }));
              void upload("heroBadge", file);
            }}
            onUrl={() => {}}
            onCommitUrl={(url) => patch("heroBadgeImageUrl", url)}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Floating badge title">
            <Input value={s.heroBadgeTitle || ""} onChange={(e) => patch("heroBadgeTitle", e.target.value)} />
          </Field>
          <Field label="Floating badge subtitle">
            <Input value={s.heroBadgeSubtitle || ""} onChange={(e) => patch("heroBadgeSubtitle", e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="font-bold text-[#0d4f46]">Social proof</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Customers line">
            <Input value={s.heroCustomersText || ""} onChange={(e) => patch("heroCustomersText", e.target.value)} />
          </Field>
          <Field label="Rating line">
            <Input value={s.heroRatingText || ""} onChange={(e) => patch("heroRatingText", e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {(
            [
              ["heroAvatar1", "heroAvatar1", "Customer photo 1"],
              ["heroAvatar2", "heroAvatar2", "Customer photo 2"],
              ["heroAvatar3", "heroAvatar3", "Customer photo 3"],
            ] as const
          ).map(([kind, key, label]) => (
            <ImagePicker
              key={kind}
              label={label}
              file={files[kind] || null}
              url=""
              existingUrl={s[key]}
              onFile={(file) => {
                setFiles((prev) => ({ ...prev, [kind]: file }));
                void upload(kind, file);
              }}
              onUrl={() => {}}
              onCommitUrl={(url) => patch(key, url)}
            />
          ))}
        </div>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="font-bold text-[#0d4f46]">Feature bar (5 items below hero)</h2>
        <div className="space-y-4">
          {features.map((row, index) => (
            <div key={index} className="grid gap-3 rounded-2xl bg-muted/30 p-4 md:grid-cols-4">
              <Field label="Icon">
                <select
                  className="h-11 w-full rounded-xl border px-3"
                  value={row.icon}
                  onChange={(e) =>
                    setFeatures((prev) =>
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
                    setFeatures((prev) =>
                      prev.map((item, i) => (i === index ? { ...item, title: e.target.value } : item)),
                    )
                  }
                />
              </Field>
              <Field label="Description">
                <Input
                  value={row.body}
                  onChange={(e) =>
                    setFeatures((prev) =>
                      prev.map((item, i) => (i === index ? { ...item, body: e.target.value } : item)),
                    )
                  }
                />
              </Field>
            </div>
          ))}
        </div>
      </Card>

      <div className="sticky bottom-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-card">
        <div className="flex flex-wrap gap-2">
          <Link href="/" className="text-sm font-semibold text-[#0d4f46] underline">
            View customer site
          </Link>
          <button type="button" className="text-sm text-muted-foreground underline" onClick={resetDefaults}>
            Reset to defaults
          </button>
        </div>
        <Btn onClick={() => void save()} disabled={saving} className="min-w-36">
          {saving ? "Saving…" : "Save hero"}
        </Btn>
      </div>
    </div>
  );
}
