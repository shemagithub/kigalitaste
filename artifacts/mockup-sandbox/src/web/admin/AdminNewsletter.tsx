import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { bumpCatalog, refreshSettings } from "../catalog";
import { NEWSLETTER_DEFAULTS, newsletterFromSettings } from "../newsletterContent";
import { Btn, Card, Empty, Field, Input, PillField, PillInput, Textarea } from "../ui";
import { AdminGuide } from "./AdminUi";

type Subscriber = {
  id: number;
  email: string;
  subscribedAt: string;
  source: string;
};

export function AdminNewsletter() {
  const [rows, setRows] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [s, setS] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      setRows(await api<Subscriber[]>("/api/admin/subscribers"));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    api<Record<string, string>>("/api/settings")
      .then((data) => setS(data))
      .catch((e) => toast.error(e.message));
  }, []);

  const preview = newsletterFromSettings(s);

  async function saveCopy() {
    if (saving) return;
    setSaving(true);
    try {
      await api("/api/admin/settings", {
        method: "PUT",
        json: {
          newsletterTitle: s.newsletterTitle || NEWSLETTER_DEFAULTS.title,
          newsletterSubtitle: s.newsletterSubtitle || NEWSLETTER_DEFAULTS.subtitle,
          newsletterPlaceholder: s.newsletterPlaceholder || NEWSLETTER_DEFAULTS.placeholder,
          newsletterButton: s.newsletterButton || NEWSLETTER_DEFAULTS.button,
        },
      });
      bumpCatalog();
      await refreshSettings();
      toast.success("Newsletter section updated");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <AdminGuide>
        <p className="font-bold">Newsletter</p>
        <p className="mt-1 text-muted-foreground">
          Customize the homepage subscribe box and view everyone who signed up.
        </p>
      </AdminGuide>

      <Card className="space-y-4 p-6">
        <h2 className="font-bold text-[#0d4f46]">Homepage subscribe box</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Title">
            <Input
              value={s.newsletterTitle || ""}
              onChange={(e) => setS({ ...s, newsletterTitle: e.target.value })}
              placeholder={NEWSLETTER_DEFAULTS.title}
            />
          </Field>
          <Field label="Button label">
            <Input
              value={s.newsletterButton || ""}
              onChange={(e) => setS({ ...s, newsletterButton: e.target.value })}
              placeholder={NEWSLETTER_DEFAULTS.button}
            />
          </Field>
          <div className="md:col-span-2">
            <Field label="Subtitle">
              <Textarea
                className="min-h-20"
                value={s.newsletterSubtitle || ""}
                onChange={(e) => setS({ ...s, newsletterSubtitle: e.target.value })}
                placeholder={NEWSLETTER_DEFAULTS.subtitle}
              />
            </Field>
          </div>
          <div className="md:col-span-2">
            <PillField label="Email placeholder" hint="Shown inside the pill input on the homepage">
              <PillInput
                value={s.newsletterPlaceholder || ""}
                onChange={(e) => setS({ ...s, newsletterPlaceholder: e.target.value })}
                placeholder={NEWSLETTER_DEFAULTS.placeholder}
                variant="soft"
              />
            </PillField>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-primary/10 bg-gradient-to-br from-secondary/30 to-white p-5">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Preview</p>
          <p className="text-lg font-bold">{preview.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{preview.subtitle}</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <PillInput
              readOnly
              value=""
              placeholder={preview.placeholder}
              variant="soft"
              wrapperClassName="flex-1"
            />
            <Btn className="shrink-0">{preview.button}</Btn>
          </div>
        </div>

        <Btn onClick={() => void saveCopy()} disabled={saving} className="min-w-36">
          {saving ? "Saving…" : "Save subscribe box"}
        </Btn>
      </Card>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading subscribers…</p>
      ) : rows.length === 0 ? (
        <Empty title="No subscribers yet" body="They will appear here when customers use the homepage subscribe form." />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border bg-muted/30 px-4 py-3 text-sm font-bold text-[#0d4f46]">
            {rows.length} subscriber{rows.length === 1 ? "" : "s"}
          </div>
          <div className="divide-y divide-border">
            {rows.map((row) => (
              <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-semibold">{row.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(row.subscribedAt).toLocaleString("en-GB", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}{" "}
                    · {row.source}
                  </p>
                </div>
                <Btn
                  variant="light"
                  className="text-destructive"
                  onClick={async () => {
                    if (!confirm(`Remove ${row.email} from the list?`)) return;
                    await api(`/api/admin/subscribers/${row.id}`, { method: "DELETE" });
                    toast.success("Removed");
                    await reload();
                  }}
                >
                  Remove
                </Btn>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
