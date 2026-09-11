import { Bike, Clock, MapPin, MessageCircle, ShieldCheck, Store, Wallet } from "lucide-react";
import { frw } from "@/lib/api";
import { shippingFromSettings } from "./shippingContent";
import { type Settings } from "./customer";
import { BtnLink, Card } from "./ui";

const SECTION_ICONS: Record<string, typeof Bike> = {
  clock: Clock,
  bike: Bike,
  map: MapPin,
  store: Store,
  wallet: Wallet,
  shield: ShieldCheck,
};

export function ShippingPage({ settings }: { settings: Settings }) {
  const shipping = shippingFromSettings(settings);
  const zones = [...(settings.deliveryZones || [])].sort((a, b) => a.fee - b.fee || a.name.localeCompare(b.name));

  return (
    <div className="space-y-12 pb-10">
      <section className="overflow-hidden rounded-[2rem] bg-[#1f1f1f] px-5 py-10 text-white shadow-2xl sm:px-8 sm:py-12 md:px-12 md:py-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">{shipping.eyebrow}</p>
          <h1 className="mt-3 text-4xl font-extrabold leading-tight md:text-5xl">
            {shipping.title}{" "}
            <span className="font-serif italic text-primary">{shipping.highlight}</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/75">{shipping.intro}</p>
        </div>
      </section>

      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {shipping.sections.map((section) => {
          const Icon = SECTION_ICONS[section.icon] || Bike;
          return (
            <Card key={section.title} className="rounded-[1.5rem] p-6 shadow-card">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-6 w-6" />
              </span>
              <h2 className="mt-4 text-lg font-bold">{section.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{section.body}</p>
            </Card>
          );
        })}
      </section>

      {shipping.showZones && zones.length > 0 ? (
        <section>
          <div className="mb-6 text-center md:text-left">
            <h2 className="text-2xl font-extrabold md:text-3xl">{shipping.zonesTitle}</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">{shipping.zonesIntro}</p>
          </div>
          <Card className="overflow-hidden rounded-[1.5rem] shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[320px] text-left text-sm">
                <thead>
                  <tr className="border-b border-black/5 bg-secondary/50 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-4">Area</th>
                    <th className="px-5 py-4 text-right">Delivery fee</th>
                  </tr>
                </thead>
                <tbody>
                  {zones.map((zone) => (
                    <tr key={zone.id} className="border-b border-black/5 last:border-0">
                      <td className="px-5 py-4 font-medium">{zone.name}</td>
                      <td className="px-5 py-4 text-right font-bold text-primary">{frw(zone.fee)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      ) : null}

      <section className="mx-auto max-w-3xl">
        <Card className="rounded-[1.75rem] bg-secondary/40 p-8 text-center shadow-card md:p-10">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MessageCircle className="h-7 w-7" />
          </span>
          <h2 className="mt-5 text-2xl font-extrabold">{shipping.contactTitle}</h2>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">{shipping.contactBody}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <BtnLink href={shipping.contactHref}>{shipping.contactButton}</BtnLink>
            <BtnLink href="/faq" variant="outline">
              Read FAQ
            </BtnLink>
          </div>
        </Card>
      </section>
    </div>
  );
}
