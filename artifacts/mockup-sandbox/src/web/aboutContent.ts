import { frw } from "@/lib/api";
import type { Settings } from "./customer";
import { deliveryAmount } from "./heroContent";

export type AboutStat = {
  label: string;
  value: string;
  hint: string;
};

export type AboutItem = {
  icon: string;
  title: string;
  body: string;
};

export const DEFAULT_ABOUT_HERO_IMAGE =
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80";

export const DEFAULT_ABOUT_STATS: AboutStat[] = [
  { label: "Local kitchens", value: "{{kitchens}}", hint: "Restaurants on the platform" },
  { label: "Delivery from", value: "{{delivery}}", hint: "Price depends on your area in Kigali" },
  { label: "Currency", value: "FRw", hint: "All menu prices shown in Rwandan Francs" },
];

export const DEFAULT_ABOUT_PRICING: AboutItem[] = [
  {
    icon: "wallet",
    title: "Menu price",
    body: "What you see on each dish is the full customer price in FRw.",
  },
  {
    icon: "bike",
    title: "Delivery fee",
    body: "Added at checkout based on your location in Kigali (from {{delivery}}). Pickup orders have no delivery fee.",
  },
  {
    icon: "shield",
    title: "Pay securely",
    body: "Mobile Money, Airtel Money, or card — pay securely at checkout.",
  },
];

export const DEFAULT_ABOUT_STEPS: AboutItem[] = [
  { icon: "utensils", title: "Choose your food", body: "Explore restaurants and dishes across Kigali." },
  { icon: "bag", title: "Place your order", body: "Add items to cart, pick delivery or pickup, and checkout in FRw." },
  { icon: "bike", title: "We deliver", body: "The kitchen prepares your meal; our team brings it to you when ready." },
  { icon: "clock", title: "Enjoy", body: "Track your order and rate it after delivery." },
];

export const DEFAULT_CUSTOMER_BULLETS = [
  "One account to order from multiple kitchens in Kigali.",
  "Save favorites, apply promo codes like WELCOME20 on your first order.",
  "Live delivery tracking when your rider is on the way.",
  "My Orders page to see status, pay, and leave a rating.",
];

export const DEFAULT_VENDOR_BULLETS = [
  "List your menu, set base prices, and go live when you are ready.",
  "Receive orders in your vendor panel and mark them preparing → ready.",
  "Get paid your menu base price after each delivered order.",
  "Upload your RDB certificate and ID to join the platform.",
];

export type AboutContent = {
  eyebrow: string;
  titleLine1: string;
  titleHighlight: string;
  intro: string;
  primaryButton: string;
  primaryHref: string;
  secondaryButton: string;
  secondaryHref: string;
  heroImage: string;
  stats: AboutStat[];
  whatTitle: string;
  whatParagraph1: string;
  whatParagraph2: string;
  pricingTitle: string;
  pricingItems: AboutItem[];
  steps: AboutItem[];
  customersTitle: string;
  customersBullets: string[];
  customersButton: string;
  customersHref: string;
  vendorsTitle: string;
  vendorsBullets: string[];
  vendorsButton: string;
  vendorsHref: string;
  contactTitle: string;
  contactBody: string;
};

export const ABOUT_SETTING_KEYS = [
  "aboutEyebrow",
  "aboutTitleLine1",
  "aboutTitleHighlight",
  "aboutIntro",
  "aboutPrimaryButton",
  "aboutPrimaryHref",
  "aboutSecondaryButton",
  "aboutSecondaryHref",
  "aboutHeroImageUrl",
  "aboutStats",
  "aboutWhatTitle",
  "aboutWhatParagraph1",
  "aboutWhatParagraph2",
  "aboutPricingTitle",
  "aboutPricingItems",
  "aboutSteps",
  "aboutCustomersTitle",
  "aboutCustomersBullets",
  "aboutCustomersButton",
  "aboutCustomersHref",
  "aboutVendorsTitle",
  "aboutVendorsBullets",
  "aboutVendorsButton",
  "aboutVendorsHref",
  "aboutContactTitle",
  "aboutContactBody",
] as const;

function parseJsonArray<T>(
  raw: unknown,
  fallback: T[],
  mapRow: (row: Record<string, unknown>, i: number) => T,
): T[] {
  if (!raw) return fallback;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed) || parsed.length === 0) return fallback;
    return parsed.map((row, i) => mapRow(row as Record<string, unknown>, i));
  } catch {
    return fallback;
  }
}

export function parseAboutStats(raw: unknown): AboutStat[] {
  return parseJsonArray(raw, DEFAULT_ABOUT_STATS, (row, i) => ({
    label: String(row.label || DEFAULT_ABOUT_STATS[i]?.label || "Stat"),
    value: String(row.value ?? DEFAULT_ABOUT_STATS[i]?.value ?? ""),
    hint: String(row.hint || DEFAULT_ABOUT_STATS[i]?.hint || ""),
  }));
}

export function parseAboutItems(raw: unknown, fallback: AboutItem[]): AboutItem[] {
  return parseJsonArray(raw, fallback, (row, i) => ({
    icon: String(row.icon || fallback[i]?.icon || "bike"),
    title: String(row.title || fallback[i]?.title || "Item"),
    body: String(row.body || fallback[i]?.body || ""),
  }));
}

export function parseBulletList(raw: unknown, fallback: string[]): string[] {
  if (!raw) return fallback;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed) || parsed.length === 0) return fallback;
    return parsed.map((line) => String(line));
  } catch {
    return fallback;
  }
}

function applyAboutTemplates(text: string, settings: Settings, liveKitchens: number) {
  const name = settings.platformName || "Kigali Taste";
  const kitchens = liveKitchens > 0 ? `${liveKitchens}+` : "Growing";
  return text
    .replace(/\{\{name\}\}/g, name)
    .replace(/\{\{delivery\}\}/g, frw(deliveryAmount(settings)))
    .replace(/\{\{kitchens\}\}/g, kitchens);
}

export function aboutFromSettings(settings: Settings, liveKitchens = 0): AboutContent {
  const tpl = (text: string) => applyAboutTemplates(text, settings, liveKitchens);

  return {
    eyebrow: settings.aboutEyebrow || "About us",
    titleLine1: settings.aboutTitleLine1 || "Good food across Kigali,",
    titleHighlight: settings.aboutTitleHighlight || "delivered with care",
    intro: tpl(
      settings.aboutIntro ||
        "{{name}} connects you with trusted local kitchens. Browse menus, pay in Rwandan Francs (FRw), and we bring your order to your door — or pick it up at the restaurant.",
    ),
    primaryButton: settings.aboutPrimaryButton || "Browse restaurants",
    primaryHref: settings.aboutPrimaryHref || "/",
    secondaryButton: settings.aboutSecondaryButton || "Become a partner",
    secondaryHref: settings.aboutSecondaryHref || "/become-a-partner",
    heroImage: settings.aboutHeroImageUrl || DEFAULT_ABOUT_HERO_IMAGE,
    stats: parseAboutStats(settings.aboutStats).map((row) => ({
      label: row.label,
      value: tpl(row.value),
      hint: row.hint,
    })),
    whatTitle: tpl(settings.aboutWhatTitle || "What is {{name}}?"),
    whatParagraph1: tpl(
      settings.aboutWhatParagraph1 ||
        "We are a multivendor food marketplace built for Kigali. Each restaurant manages its own menu and prepares your food. {{name}} handles delivery, customer support, and secure payments so you get a simple ordering experience from start to finish.",
    ),
    whatParagraph2: tpl(
      settings.aboutWhatParagraph2 ||
        "Whether you want pizza in Remera, brochettes in Kacyiru, or a quick lunch near your office, you order once on the site and track progress until it arrives.",
    ),
    pricingTitle: settings.aboutPricingTitle || "How pricing works",
    pricingItems: parseAboutItems(settings.aboutPricingItems, DEFAULT_ABOUT_PRICING).map((row) => ({
      icon: row.icon,
      title: row.title,
      body: tpl(row.body),
    })),
    steps: parseAboutItems(settings.aboutSteps, DEFAULT_ABOUT_STEPS),
    customersTitle: settings.aboutCustomersTitle || "For customers",
    customersBullets: parseBulletList(settings.aboutCustomersBullets, DEFAULT_CUSTOMER_BULLETS),
    customersButton: settings.aboutCustomersButton || "Create free account",
    customersHref: settings.aboutCustomersHref || "/register",
    vendorsTitle: settings.aboutVendorsTitle || "For restaurants",
    vendorsBullets: parseBulletList(settings.aboutVendorsBullets, DEFAULT_VENDOR_BULLETS),
    vendorsButton: settings.aboutVendorsButton || "Apply as a partner",
    vendorsHref: settings.aboutVendorsHref || "/become-a-partner",
    contactTitle: settings.aboutContactTitle || "Questions? We are here.",
    contactBody:
      settings.aboutContactBody ||
      "Reach our team for orders, partnerships, or support. We reply in English.",
  };
}

export function aboutDefaultsRecord(): Record<string, string> {
  return {
    aboutEyebrow: "About us",
    aboutTitleLine1: "Good food across Kigali,",
    aboutTitleHighlight: "delivered with care",
    aboutIntro:
      "{{name}} connects you with trusted local kitchens. Browse menus, pay in Rwandan Francs (FRw), and we bring your order to your door — or pick it up at the restaurant.",
    aboutPrimaryButton: "Browse restaurants",
    aboutPrimaryHref: "/",
    aboutSecondaryButton: "Become a partner",
    aboutSecondaryHref: "/become-a-partner",
    aboutHeroImageUrl: DEFAULT_ABOUT_HERO_IMAGE,
    aboutStats: JSON.stringify(DEFAULT_ABOUT_STATS),
    aboutWhatTitle: "What is {{name}}?",
    aboutWhatParagraph1:
      "We are a multivendor food marketplace built for Kigali. Each restaurant manages its own menu and prepares your food. {{name}} handles delivery, customer support, and secure payments so you get a simple ordering experience from start to finish.",
    aboutWhatParagraph2:
      "Whether you want pizza in Remera, brochettes in Kacyiru, or a quick lunch near your office, you order once on the site and track progress until it arrives.",
    aboutPricingTitle: "How pricing works",
    aboutPricingItems: JSON.stringify(DEFAULT_ABOUT_PRICING),
    aboutSteps: JSON.stringify(DEFAULT_ABOUT_STEPS),
    aboutCustomersTitle: "For customers",
    aboutCustomersBullets: JSON.stringify(DEFAULT_CUSTOMER_BULLETS),
    aboutCustomersButton: "Create free account",
    aboutCustomersHref: "/register",
    aboutVendorsTitle: "For restaurants",
    aboutVendorsBullets: JSON.stringify(DEFAULT_VENDOR_BULLETS),
    aboutVendorsButton: "Apply as a partner",
    aboutVendorsHref: "/become-a-partner",
    aboutContactTitle: "Questions? We are here.",
    aboutContactBody: "Reach our team for orders, partnerships, or support. We reply in English.",
  };
}
