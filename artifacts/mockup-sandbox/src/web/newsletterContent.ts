import type { Settings } from "./customer";

export const NEWSLETTER_DEFAULTS = {
  title: "Stay updated",
  subtitle: "New kitchens, offers, and delivery news in Kigali — no spam.",
  placeholder: "you@example.com",
  button: "Subscribe",
};

export function newsletterFromSettings(settings: Settings) {
  return {
    title: settings.newsletterTitle || NEWSLETTER_DEFAULTS.title,
    subtitle: settings.newsletterSubtitle || NEWSLETTER_DEFAULTS.subtitle,
    placeholder: settings.newsletterPlaceholder || NEWSLETTER_DEFAULTS.placeholder,
    button: settings.newsletterButton || NEWSLETTER_DEFAULTS.button,
  };
}
