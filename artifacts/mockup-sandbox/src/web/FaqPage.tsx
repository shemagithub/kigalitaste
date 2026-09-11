import { ChevronDown, HelpCircle, MessageCircle } from "lucide-react";
import { faqFromSettings } from "./faqContent";
import { type Settings } from "./customer";
import { BtnLink, Card } from "./ui";

export function FaqPage({ settings }: { settings: Settings }) {
  const faq = faqFromSettings(settings);

  return (
    <div className="space-y-12 pb-10">
      <section className="overflow-hidden rounded-[2rem] bg-[#1f1f1f] px-5 py-10 text-white shadow-2xl sm:px-8 sm:py-12 md:px-12 md:py-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">{faq.eyebrow}</p>
          <h1 className="mt-3 text-4xl font-extrabold leading-tight md:text-5xl">
            {faq.title}{" "}
            <span className="font-serif italic text-primary">{faq.highlight}</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/75">{faq.intro}</p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl space-y-3">
        {faq.items.map((item, index) => (
          <details
            key={`${item.q}-${index}`}
            className="group overflow-hidden rounded-[1.25rem] border border-black/5 bg-white shadow-card open:shadow-md"
          >
            <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-4 font-semibold outline-none marker:content-none md:px-6 md:py-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <HelpCircle className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1 text-left text-base md:text-lg">{item.q}</span>
              <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition group-open:rotate-180" />
            </summary>
            <div className="border-t border-black/5 px-5 pb-5 pt-4 text-sm leading-relaxed text-muted-foreground md:px-6 md:pb-6 md:text-base">
              {item.a}
            </div>
          </details>
        ))}
      </section>

      <section className="mx-auto max-w-3xl">
        <Card className="rounded-[1.75rem] bg-secondary/40 p-8 text-center shadow-card md:p-10">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MessageCircle className="h-7 w-7" />
          </span>
          <h2 className="mt-5 text-2xl font-extrabold">{faq.contactTitle}</h2>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">{faq.contactBody}</p>
          <div className="mt-6">
            <BtnLink href={faq.contactHref}>{faq.contactButton}</BtnLink>
          </div>
        </Card>
      </section>
    </div>
  );
}
