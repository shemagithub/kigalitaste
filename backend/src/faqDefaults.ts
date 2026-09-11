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

export function faqDefaultSettings(): Record<string, string> {
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
    faqItems: JSON.stringify([
      {
        q: "How long does delivery take?",
        a: "Most orders in Kigali arrive in 25–45 minutes after the restaurant accepts your order. Busy hours may take a little longer — you can track status on My Orders.",
      },
      {
        q: "What payment methods do you accept?",
        a: "MTN MoMo, Airtel Money, and card at checkout. All prices are shown in Rwandan Francs (FRw).",
      },
      {
        q: "How much is delivery?",
        a: "Delivery fees depend on your sector in Kigali — from {{delivery}}. Pickup orders have no delivery fee. The exact fee is shown before you pay.",
      },
      {
        q: "Can I cancel an order?",
        a: "Yes, while the order is still pending or before the kitchen starts preparing. Open My Orders and tap Cancel, or contact us if you need help.",
      },
      {
        q: "How do promo codes work?",
        a: "Enter a code like WELCOME20 at checkout. Valid codes apply to eligible orders — the discount is shown before you confirm payment.",
      },
      {
        q: "Can I pick up instead of delivery?",
        a: "Yes. Choose Pickup at checkout and collect your food at the restaurant when it is marked Ready.",
      },
      {
        q: "How do I track my order?",
        a: "Go to My Orders for live status — placed, preparing, ready, on the way, and delivered. You will also get email updates.",
      },
      {
        q: "I'm a restaurant — how do I join?",
        a: "Apply on Become a partner, upload your RDB certificate and ID, and our team will review your application.",
      },
    ]),
  };
}

export async function seedFaqSettingsIfMissing(
  setting: (key: string) => Promise<string>,
  setSetting: (key: string, value: string) => Promise<void>,
) {
  for (const [key, value] of Object.entries(faqDefaultSettings())) {
    const current = await setting(key);
    if (!current) await setSetting(key, value);
  }
}
