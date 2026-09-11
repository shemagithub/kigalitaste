import { Link } from "wouter";
import {
  Bike,
  Clock,
  Handshake,
  MapPin,
  Mail,
  Phone,
  ShieldCheck,
  ShoppingBag,
  Store,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { useCatalog } from "./catalog";
import { type Settings } from "./customer";
import { aboutFromSettings } from "./aboutContent";
import { Btn, BtnLink, Card } from "./ui";

const STEP_ICONS: Record<string, typeof UtensilsCrossed> = {
  utensils: UtensilsCrossed,
  bag: ShoppingBag,
  bike: Bike,
  clock: Clock,
};

const PRICING_ICONS: Record<string, typeof Wallet> = {
  wallet: Wallet,
  bike: Bike,
  shield: ShieldCheck,
};

export function AboutPage({ settings }: { settings: Settings }) {
  const catalog = useCatalog();
  const liveKitchens = catalog?.restaurants.filter((r) => r.isOpen !== 0).length ?? catalog?.restaurants.length ?? 0;
  const about = aboutFromSettings(settings, liveKitchens);

  return (
    <div className="space-y-14 pb-10">
      <section className="overflow-hidden rounded-[2rem] bg-[#1f1f1f] text-white shadow-2xl">
        <div className="grid lg:grid-cols-2">
          <div className="flex flex-col justify-center px-8 py-12 md:px-12 md:py-16">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">{about.eyebrow}</p>
            <h1 className="mt-3 text-4xl font-extrabold leading-tight md:text-5xl">
              {about.titleLine1}{" "}
              <span className="font-serif italic text-primary">{about.titleHighlight}</span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-white/75">{about.intro}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <BtnLink href={about.primaryHref}>{about.primaryButton}</BtnLink>
              <BtnLink href={about.secondaryHref} variant="outline">
                {about.secondaryButton}
              </BtnLink>
            </div>
          </div>
          <div className="relative min-h-[260px] lg:min-h-full">
            <img src={about.heroImage} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#1f1f1f] via-[#1f1f1f]/20 to-transparent lg:via-transparent" />
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {about.stats.map((stat) => (
          <Card key={stat.label} className="rounded-[1.5rem] p-6 text-center shadow-card">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{stat.label}</p>
            <p className="mt-2 text-3xl font-extrabold text-primary">{stat.value}</p>
            <p className="mt-2 text-sm text-muted-foreground">{stat.hint}</p>
          </Card>
        ))}
      </section>

      <section className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-start">
        <div>
          <h2 className="text-2xl font-extrabold md:text-3xl">{about.whatTitle}</h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">{about.whatParagraph1}</p>
          <p className="mt-4 leading-relaxed text-muted-foreground">{about.whatParagraph2}</p>
        </div>
        <Card className="space-y-4 rounded-[1.75rem] bg-secondary/40 p-6 shadow-card">
          <h3 className="text-lg font-bold">{about.pricingTitle}</h3>
          <ul className="space-y-3 text-sm text-muted-foreground">
            {about.pricingItems.map(({ icon, title, body }) => {
              const Icon = PRICING_ICONS[icon] || Wallet;
              return (
                <li key={title} className="flex gap-3">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>
                    <strong className="text-foreground">{title}</strong> — {body}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      </section>

      <section>
        <h2 className="mb-8 text-center text-2xl font-extrabold md:text-3xl">How it works</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {about.steps.map(({ icon, title, body }) => {
            const Icon = STEP_ICONS[icon] || UtensilsCrossed;
            return (
              <Card key={title} className="rounded-[1.5rem] p-5 text-center shadow-card">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-primary">
                  <Icon className="h-6 w-6" />
                </span>
                <p className="mt-4 font-bold">{title}</p>
                <p className="mt-2 text-sm text-muted-foreground">{body}</p>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-[1.75rem] p-8 shadow-card">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Store className="h-5 w-5" />
            </span>
            <h3 className="text-xl font-bold">{about.customersTitle}</h3>
          </div>
          <ul className="mt-5 space-y-3 text-sm text-muted-foreground">
            {about.customersBullets.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <Link href={about.customersHref} className="mt-6 inline-block">
            <Btn>{about.customersButton}</Btn>
          </Link>
        </Card>

        <Card className="rounded-[1.75rem] border border-primary/20 bg-[linear-gradient(145deg,#fff7ed,#ffffff)] p-8 shadow-card">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-white">
              <Handshake className="h-5 w-5" />
            </span>
            <h3 className="text-xl font-bold">{about.vendorsTitle}</h3>
          </div>
          <ul className="mt-5 space-y-3 text-sm text-muted-foreground">
            {about.vendorsBullets.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <Link href={about.vendorsHref} className="mt-6 inline-block">
            <Btn>{about.vendorsButton}</Btn>
          </Link>
        </Card>
      </section>

      {settings.terms ? (
        <section>
          <h2 className="mb-4 text-2xl font-extrabold">Terms & trust</h2>
          <Card className="rounded-[1.5rem] p-6 shadow-card">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{settings.terms}</p>
          </Card>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-[1.75rem] bg-[linear-gradient(135deg,#ea580c,#c2410c)] p-8 text-white md:p-10">
        <div className="grid gap-8 md:grid-cols-2 md:items-center">
          <div>
            <h2 className="text-2xl font-extrabold md:text-3xl">{about.contactTitle}</h2>
            <p className="mt-3 text-white/85">{about.contactBody}</p>
          </div>
          <div className="space-y-3 text-sm">
            {settings.phone ? (
              <p className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3">
                <Phone className="h-4 w-4 shrink-0" />
                <a href={`tel:${settings.phone}`} className="font-semibold hover:underline">
                  {settings.phone}
                </a>
              </p>
            ) : null}
            {settings.email ? (
              <p className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3">
                <Mail className="h-4 w-4 shrink-0" />
                <a href={`mailto:${settings.email}`} className="font-semibold hover:underline">
                  {settings.email}
                </a>
              </p>
            ) : null}
            {settings.address ? (
              <p className="flex items-start gap-3 rounded-2xl bg-white/10 px-4 py-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{settings.address}</span>
              </p>
            ) : null}
            <BtnLink href="/contact" variant="light" className="mt-2 w-full md:w-auto">
              Send a message
            </BtnLink>
          </div>
        </div>
      </section>
    </div>
  );
}
