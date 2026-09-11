import type { Settings } from "./customer";
import { frw } from "@/lib/api";

export const DEFAULT_HERO_IMAGES = {
  main: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=900&q=80",
  badge: "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=400&q=80",
  avatars: [
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=80&q=80",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=80&q=80",
    "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=80&q=80",
  ],
};

export type HeroFeature = {
  title: string;
  body: string;
  icon: string;
};

export const DEFAULT_HERO_FEATURES: HeroFeature[] = [
  { icon: "bike", title: "Fast Delivery", body: "Get your food in 30 minutes" },
  { icon: "utensils", title: "Best Quality", body: "Fresh ingredients & top quality" },
  { icon: "tag", title: "Best Prices", body: "Great food at honest FRw prices" },
  { icon: "headphones", title: "24/7 Support", body: "We're here for you anytime" },
  { icon: "percent", title: "Exclusive Offers", body: "Enjoy discounts & special deals" },
];

export type HeroContent = {
  titleLine1: string;
  titleHighlight: string;
  subtitle: string;
  primaryButton: string;
  primaryHref: string;
  secondaryButton: string;
  secondaryHref: string;
  mainImage: string;
  badgeImage: string;
  badgeTitle: string;
  badgeSubtitle: string;
  customersText: string;
  ratingText: string;
  avatars: string[];
  topBannerText: string;
  topBannerTagline: string;
  features: HeroFeature[];
};

export function deliveryAmount(settings: Settings) {
  return settings.deliveryFrom ?? Number(settings.deliveryFee || 1500);
}

function applyDeliveryTemplate(text: string, settings: Settings) {
  return text.replace(/\{\{delivery\}\}/g, frw(deliveryAmount(settings)));
}

export function parseHeroFeatures(raw: unknown): HeroFeature[] {
  if (!raw) return DEFAULT_HERO_FEATURES;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_HERO_FEATURES;
    return parsed.map((row, i) => ({
      title: String(row.title || DEFAULT_HERO_FEATURES[i]?.title || "Feature"),
      body: String(row.body || DEFAULT_HERO_FEATURES[i]?.body || ""),
      icon: String(row.icon || DEFAULT_HERO_FEATURES[i]?.icon || "bike"),
    }));
  } catch {
    return DEFAULT_HERO_FEATURES;
  }
}

export function heroFromSettings(settings: Settings): HeroContent {
  return {
    titleLine1: settings.heroTitleLine1 || "Delicious Food,",
    titleHighlight: settings.heroTitleHighlight || "Delivered To You",
    subtitle: applyDeliveryTemplate(
      settings.heroSubtitle ||
        "Your favorite meals from Kigali kitchens, delivered fast and fresh to your door. Prices in FRw. Delivery from {{delivery}}.",
      settings,
    ),
    primaryButton: settings.heroPrimaryButton || "Order Now →",
    primaryHref: settings.heroPrimaryHref || "",
    secondaryButton: settings.heroSecondaryButton || "Explore Menu",
    secondaryHref: settings.heroSecondaryHref || "/menu",
    mainImage: settings.heroImageUrl || DEFAULT_HERO_IMAGES.main,
    badgeImage: settings.heroBadgeImageUrl || DEFAULT_HERO_IMAGES.badge,
    badgeTitle: settings.heroBadgeTitle || "Fast Delivery",
    badgeSubtitle: settings.heroBadgeSubtitle || "30 mins",
    customersText: settings.heroCustomersText || "10K+ Happy Customers",
    ratingText: settings.heroRatingText || "4.9 rating",
    avatars: [
      settings.heroAvatar1 || DEFAULT_HERO_IMAGES.avatars[0],
      settings.heroAvatar2 || DEFAULT_HERO_IMAGES.avatars[1],
      settings.heroAvatar3 || DEFAULT_HERO_IMAGES.avatars[2],
    ],
    topBannerText: settings.topBannerText || "Free delivery on orders over 25,000 FRw",
    topBannerTagline: settings.topBannerTagline || "Good Food, Delivered Fast 🍕",
    features: parseHeroFeatures(settings.heroFeatures),
  };
}

export const HERO_SETTING_KEYS = [
  "heroTitleLine1",
  "heroTitleHighlight",
  "heroSubtitle",
  "heroPrimaryButton",
  "heroPrimaryHref",
  "heroSecondaryButton",
  "heroSecondaryHref",
  "heroImageUrl",
  "heroBadgeImageUrl",
  "heroBadgeTitle",
  "heroBadgeSubtitle",
  "heroCustomersText",
  "heroRatingText",
  "heroAvatar1",
  "heroAvatar2",
  "heroAvatar3",
  "topBannerText",
  "topBannerTagline",
  "heroFeatures",
] as const;

export function heroDefaultsRecord(): Record<string, string> {
  return {
    heroTitleLine1: "Delicious Food,",
    heroTitleHighlight: "Delivered To You",
    heroSubtitle:
      "Your favorite meals from Kigali kitchens, delivered fast and fresh to your door. Prices in FRw. Delivery from {{delivery}}.",
    heroPrimaryButton: "Order Now →",
    heroPrimaryHref: "",
    heroSecondaryButton: "Explore Menu",
    heroSecondaryHref: "/menu",
    heroImageUrl: DEFAULT_HERO_IMAGES.main,
    heroBadgeImageUrl: DEFAULT_HERO_IMAGES.badge,
    heroBadgeTitle: "Fast Delivery",
    heroBadgeSubtitle: "30 mins",
    heroCustomersText: "10K+ Happy Customers",
    heroRatingText: "4.9 rating",
    heroAvatar1: DEFAULT_HERO_IMAGES.avatars[0],
    heroAvatar2: DEFAULT_HERO_IMAGES.avatars[1],
    heroAvatar3: DEFAULT_HERO_IMAGES.avatars[2],
    topBannerText: "Free delivery on orders over 25,000 FRw",
    topBannerTagline: "Good Food, Delivered Fast 🍕",
    heroFeatures: JSON.stringify(DEFAULT_HERO_FEATURES),
  };
}
