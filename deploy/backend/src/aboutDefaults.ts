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

export function aboutDefaultSettings(): Record<string, string> {
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
    aboutHeroImageUrl:
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80",
    aboutStats: JSON.stringify([
      { label: "Local kitchens", value: "{{kitchens}}", hint: "Restaurants on the platform" },
      { label: "Delivery from", value: "{{delivery}}", hint: "Price depends on your area in Kigali" },
      { label: "Currency", value: "FRw", hint: "All menu prices shown in Rwandan Francs" },
    ]),
    aboutWhatTitle: "What is {{name}}?",
    aboutWhatParagraph1:
      "We are a multivendor food marketplace built for Kigali. Each restaurant manages its own menu and prepares your food. {{name}} handles delivery, customer support, and secure payments so you get a simple ordering experience from start to finish.",
    aboutWhatParagraph2:
      "Whether you want pizza in Remera, brochettes in Kacyiru, or a quick lunch near your office, you order once on the site and track progress until it arrives.",
    aboutPricingTitle: "How pricing works",
    aboutPricingItems: JSON.stringify([
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
    ]),
    aboutSteps: JSON.stringify([
      { icon: "utensils", title: "Choose your food", body: "Explore restaurants and dishes across Kigali." },
      { icon: "bag", title: "Place your order", body: "Add items to cart, pick delivery or pickup, and checkout in FRw." },
      { icon: "bike", title: "We deliver", body: "The kitchen prepares your meal; our team brings it to you when ready." },
      { icon: "clock", title: "Enjoy", body: "Track your order and rate it after delivery." },
    ]),
    aboutCustomersTitle: "For customers",
    aboutCustomersBullets: JSON.stringify([
      "One account to order from multiple kitchens in Kigali.",
      "Save favorites, apply promo codes like WELCOME20 on your first order.",
      "Live delivery tracking when your rider is on the way.",
      "My Orders page to see status, pay, and leave a rating.",
    ]),
    aboutCustomersButton: "Create free account",
    aboutCustomersHref: "/register",
    aboutVendorsTitle: "For restaurants",
    aboutVendorsBullets: JSON.stringify([
      "List your menu, set base prices, and go live when you are ready.",
      "Receive orders in your vendor panel and mark them preparing → ready.",
      "Get paid your menu base price after each delivered order.",
      "Upload your RDB certificate and ID to join the platform.",
    ]),
    aboutVendorsButton: "Apply as a partner",
    aboutVendorsHref: "/become-a-partner",
    aboutContactTitle: "Questions? We are here.",
    aboutContactBody: "Reach our team for orders, partnerships, or support. We reply in English.",
  };
}

export async function seedAboutSettingsIfMissing(
  setting: (key: string) => Promise<string>,
  setSetting: (key: string, value: string) => Promise<void>,
) {
  for (const [key, value] of Object.entries(aboutDefaultSettings())) {
    const current = await setting(key);
    if (!current) await setSetting(key, value);
  }
}
