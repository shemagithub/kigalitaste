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

export function heroDefaultSettings(): Record<string, string> {
  return {
    heroTitleLine1: "Delicious Food,",
    heroTitleHighlight: "Delivered To You",
    heroSubtitle:
      "Your favorite meals from Kigali kitchens, delivered fast and fresh to your door. Prices in FRw. Delivery from {{delivery}}.",
    heroPrimaryButton: "Order Now →",
    heroPrimaryHref: "",
    heroSecondaryButton: "Explore Menu",
    heroSecondaryHref: "/menu",
    heroImageUrl:
      "https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=900&q=80",
    heroBadgeImageUrl:
      "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=400&q=80",
    heroBadgeTitle: "Fast Delivery",
    heroBadgeSubtitle: "30 mins",
    heroCustomersText: "10K+ Happy Customers",
    heroRatingText: "4.9 rating",
    heroAvatar1:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=80&q=80",
    heroAvatar2:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=80&q=80",
    heroAvatar3:
      "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=80&q=80",
    topBannerText: "Free delivery on orders over 25,000 FRw",
    topBannerTagline: "Good Food, Delivered Fast 🍕",
    heroFeatures: JSON.stringify([
      { icon: "bike", title: "Fast Delivery", body: "Get your food in 30 minutes" },
      { icon: "utensils", title: "Best Quality", body: "Fresh ingredients & top quality" },
      { icon: "tag", title: "Best Prices", body: "Great food at honest FRw prices" },
      { icon: "headphones", title: "24/7 Support", body: "We're here for you anytime" },
      { icon: "percent", title: "Exclusive Offers", body: "Enjoy discounts & special deals" },
    ]),
  };
}

export async function seedHeroSettingsIfMissing(
  setting: (key: string) => Promise<string>,
  setSetting: (key: string, value: string) => Promise<void>,
) {
  for (const [key, value] of Object.entries(heroDefaultSettings())) {
    const current = await setting(key);
    if (!current) await setSetting(key, value);
  }
}

export const UPLOAD_KIND_TO_SETTING: Record<string, string> = {
  favicon: "faviconUrl",
  logo: "logoUrl",
  heroMain: "heroImageUrl",
  heroBadge: "heroBadgeImageUrl",
  heroAvatar1: "heroAvatar1",
  heroAvatar2: "heroAvatar2",
  heroAvatar3: "heroAvatar3",
  aboutHero: "aboutHeroImageUrl",
};
