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

export function shippingDefaultSettings(): Record<string, string> {
  return {
    shippingEyebrow: "Delivery",
    shippingTitle: "Shipping &",
    shippingHighlight: "delivery",
    shippingIntro:
      "{{name}} delivers across Kigali. Fees depend on your sector — see the table below. Pickup is always free at the restaurant.",
    shippingShowZones: "true",
    shippingZonesTitle: "Delivery fees by area",
    shippingZonesIntro: "Select your sector at checkout for an exact quote. Fees below are starting prices in FRw.",
    shippingSections: JSON.stringify([
      {
        icon: "clock",
        title: "Delivery times",
        body: "Typical delivery is 25–45 minutes after the restaurant accepts your order. Peak lunch and dinner may take longer.",
      },
      {
        icon: "bike",
        title: "How delivery works",
        body: "We pick up your order when the kitchen marks it Ready and bring it to your address. Track progress on My Orders.",
      },
      {
        icon: "map",
        title: "Coverage",
        body: "We deliver to sectors across Kigali city. Enter your location at checkout — if we cannot deliver, you will see a message before paying.",
      },
      {
        icon: "store",
        title: "Pickup option",
        body: "Choose Pickup at checkout and collect at the restaurant. No delivery fee — ideal when you are nearby.",
      },
      {
        icon: "wallet",
        title: "Fees & payment",
        body: "Menu prices plus delivery fee (from {{delivery}}) at checkout. Pay with MoMo, Airtel Money, or card in FRw.",
      },
      {
        icon: "shield",
        title: "Order issues",
        body: "Wrong or missing items? Contact us within 24 hours with your order number and we will make it right.",
      },
    ]),
    shippingContactTitle: "Need help with delivery?",
    shippingContactBody: "Tell us your order number and delivery address — we will follow up quickly.",
    shippingContactButton: "Get in touch",
    shippingContactHref: "/contact",
  };
}

export async function seedShippingSettingsIfMissing(
  setting: (key: string) => Promise<string>,
  setSetting: (key: string, value: string) => Promise<void>,
) {
  for (const [key, value] of Object.entries(shippingDefaultSettings())) {
    const current = await setting(key);
    if (!current) await setSetting(key, value);
  }
}
