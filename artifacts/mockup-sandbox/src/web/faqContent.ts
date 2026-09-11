import { frw } from "@/lib/api";
import type { Settings } from "./customer";
import { deliveryAmount } from "./heroContent";

export type FaqItem = { q: string; a: string };

export const DEFAULT_FAQ_ITEMS: FaqItem[] = [
  {
    q: "How long does delivery take?",
    a: "Most orders in Kigali arrive in 25–45 minutes after the restaurant accepts your order.",
  },
  {
    q: "What payment methods do you accept?",
    a: "MTN MoMo, Airtel Money, and card at checkout. All prices are in FRw.",
  },
  {
    q: "How much is delivery?",
    a: "Fees depend on your sector — from {{delivery}}. Pickup is free.",
  },
  {
    q: "Can I cancel an order?",
    a: "Yes, before the kitchen starts preparing. Use My Orders or contact us.",
  },
];

export const FAQ_SETTING_KEYS = [
  "faqEyebrow",
  "faqTitle",
  "faqHighlight",
  "faqIntro",
  "faqContactTitle",
  "faqContactBody",
  "faqContactButton",
  "faqContactHref",
  "faqItems",
] as const;

export type FaqContent = {
  eyebrow: string;
  title: string;
  highlight: string;
  intro: string;
  items: FaqItem[];
  contactTitle: string;
  contactBody: string;
  contactButton: string;
  contactHref: string;
};

function tpl(text: string, settings: Settings) {
  const name = settings.platformName || "Kigali Taste";
  return text
    .replace(/\{\{name\}\}/g, name)
    .replace(/\{\{delivery\}\}/g, frw(deliveryAmount(settings)));
}

export function parseFaqItems(raw: unknown): FaqItem[] {
  if (!raw) return DEFAULT_FAQ_ITEMS;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_FAQ_ITEMS;
    return parsed.map((row, i) => ({
      q: String((row as FaqItem).q || DEFAULT_FAQ_ITEMS[i]?.q || "Question"),
      a: String((row as FaqItem).a || DEFAULT_FAQ_ITEMS[i]?.a || ""),
    }));
  } catch {
    return DEFAULT_FAQ_ITEMS;
  }
}

export function faqFromSettings(settings: Settings): FaqContent {
  return {
    eyebrow: settings.faqEyebrow || "Help centre",
    title: settings.faqTitle || "Frequently asked",
    highlight: settings.faqHighlight || "questions",
    intro: tpl(
      settings.faqIntro ||
        "Quick answers about ordering, delivery, payments, and your {{name}} account.",
      settings,
    ),
    items: parseFaqItems(settings.faqItems).map((item) => ({
      q: item.q,
      a: tpl(item.a, settings),
    })),
    contactTitle: settings.faqContactTitle || "Didn't find your answer?",
    contactBody:
      settings.faqContactBody ||
      "Message us and we will get back to you as soon as we can.",
    contactButton: settings.faqContactButton || "Contact support",
    contactHref: settings.faqContactHref || "/contact",
  };
}

export function faqDefaultsRecord(): Record<string, string> {
  return {
    faqEyebrow: "Help centre",
    faqTitle: "Frequently asked",
    faqHighlight: "questions",
    faqIntro:
      "Quick answers about ordering, delivery, payments, and your {{name}} account. Still stuck? Our team is happy to help.",
    faqContactTitle: "Didn't find your answer?",
    faqContactBody: "Message us and we will get back to you as soon as we can — usually within one business day.",
    faqContactButton: "Contact support",
    faqContactHref: "/contact",
    faqItems: JSON.stringify(DEFAULT_FAQ_ITEMS),
  };
}
