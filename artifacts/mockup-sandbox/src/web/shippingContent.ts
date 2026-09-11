import { frw } from "@/lib/api";
import type { Settings } from "./customer";
import { deliveryAmount } from "./heroContent";

export type ShippingSection = {
  icon: string;
  title: string;
  body: string;
};

export const DEFAULT_SHIPPING_SECTIONS: ShippingSection[] = [
  {
    icon: "clock",
    title: "Delivery times",
    body: "Typical delivery is 25–45 minutes after the restaurant accepts your order.",
  },
  {
    icon: "bike",
    title: "How delivery works",
    body: "We pick up when the kitchen marks your order Ready and deliver to your address.",
  },
  {
    icon: "map",
    title: "Coverage",
    body: "We deliver across Kigali — enter your location at checkout for availability.",
  },
  {
    icon: "store",
    title: "Pickup option",
    body: "Choose Pickup at checkout — no delivery fee.",
  },
];

export const SHIPPING_SETTING_KEYS = [
  "shippingEyebrow",
  "shippingTitle",
  "shippingHighlight",
  "shippingIntro",
  "shippingShowZones",
  "shippingZonesTitle",
  "shippingZonesIntro",
  "shippingSections",
  "shippingContactTitle",
  "shippingContactBody",
  "shippingContactButton",
  "shippingContactHref",
] as const;

export type ShippingContent = {
  eyebrow: string;
  title: string;
  highlight: string;
  intro: string;
  showZones: boolean;
  zonesTitle: string;
  zonesIntro: string;
  sections: ShippingSection[];
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

export function parseShippingSections(raw: unknown): ShippingSection[] {
  if (!raw) return DEFAULT_SHIPPING_SECTIONS;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_SHIPPING_SECTIONS;
    return parsed.map((row, i) => ({
      icon: String((row as ShippingSection).icon || DEFAULT_SHIPPING_SECTIONS[i]?.icon || "bike"),
      title: String((row as ShippingSection).title || DEFAULT_SHIPPING_SECTIONS[i]?.title || "Section"),
      body: String((row as ShippingSection).body || DEFAULT_SHIPPING_SECTIONS[i]?.body || ""),
    }));
  } catch {
    return DEFAULT_SHIPPING_SECTIONS;
  }
}

export function shippingFromSettings(settings: Settings): ShippingContent {
  return {
    eyebrow: settings.shippingEyebrow || "Delivery",
    title: settings.shippingTitle || "Shipping &",
    highlight: settings.shippingHighlight || "delivery",
    intro: tpl(
      settings.shippingIntro ||
        "{{name}} delivers across Kigali. Fees depend on your sector.",
      settings,
    ),
    showZones: settings.shippingShowZones !== "false",
    zonesTitle: settings.shippingZonesTitle || "Delivery fees by area",
    zonesIntro: tpl(
      settings.shippingZonesIntro ||
        "Select your sector at checkout for an exact quote.",
      settings,
    ),
    sections: parseShippingSections(settings.shippingSections).map((row) => ({
      icon: row.icon,
      title: row.title,
      body: tpl(row.body, settings),
    })),
    contactTitle: settings.shippingContactTitle || "Need help with delivery?",
    contactBody:
      settings.shippingContactBody ||
      "Tell us your order number and delivery address.",
    contactButton: settings.shippingContactButton || "Get in touch",
    contactHref: settings.shippingContactHref || "/contact",
  };
}

export function shippingDefaultsRecord(): Record<string, string> {
  return {
    shippingEyebrow: "Delivery",
    shippingTitle: "Shipping &",
    shippingHighlight: "delivery",
    shippingIntro:
      "{{name}} delivers across Kigali. Fees depend on your sector — see the table below. Pickup is always free at the restaurant.",
    shippingShowZones: "true",
    shippingZonesTitle: "Delivery fees by area",
    shippingZonesIntro: "Select your sector at checkout for an exact quote. Fees below are starting prices in FRw.",
    shippingSections: JSON.stringify(DEFAULT_SHIPPING_SECTIONS),
    shippingContactTitle: "Need help with delivery?",
    shippingContactBody: "Tell us your order number and delivery address — we will follow up quickly.",
    shippingContactButton: "Get in touch",
    shippingContactHref: "/contact",
  };
}
