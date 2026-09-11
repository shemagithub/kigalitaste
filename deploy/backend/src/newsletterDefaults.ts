export const NEWSLETTER_SETTING_KEYS = [
  "newsletterTitle",
  "newsletterSubtitle",
  "newsletterPlaceholder",
  "newsletterButton",
] as const;

export function newsletterDefaultSettings(): Record<string, string> {
  return {
    newsletterTitle: "Stay updated",
    newsletterSubtitle: "New kitchens, offers, and delivery news in Kigali — no spam.",
    newsletterPlaceholder: "you@example.com",
    newsletterButton: "Subscribe",
  };
}

export async function seedNewsletterSettingsIfMissing(
  setting: (key: string) => Promise<string>,
  setSetting: (key: string, value: string) => Promise<void>,
) {
  for (const [key, value] of Object.entries(newsletterDefaultSettings())) {
    const current = await setting(key);
    if (!current) await setSetting(key, value);
  }
}
