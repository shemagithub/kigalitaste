import { useEffect } from "react";
import { useLocation } from "wouter";
import { API_BASE, img } from "@/lib/api";
import { useCatalog, useSettings } from "./catalog";
import type { MenuItem, Restaurant, Settings } from "./customer";

const DEFAULT_DESC =
  "Order food delivery in Kigali with Kigali Taste. Browse local restaurants, menus, promos, and pay in FRw — delivered across Kigali.";

function siteOrigin() {
  if (typeof window === "undefined") return "https://kigalitaste.co";
  return window.location.origin.replace(/\/$/, "");
}

function brandName(settings?: Settings | null) {
  return String(settings?.platformName || "Kigali Taste").trim() || "Kigali Taste";
}

function absoluteUrl(pathOrUrl: string, settings?: Settings | null) {
  const raw = String(pathOrUrl || "").trim();
  if (!raw) return siteOrigin();
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/uploads") || raw.startsWith("uploads/")) {
    const path = raw.startsWith("/") ? raw : `/${raw}`;
    return `${API_BASE || siteOrigin()}${path}`;
  }
  const resolved = img(raw);
  if (/^https?:\/\//i.test(resolved)) return resolved;
  const path = resolved.startsWith("/") ? resolved : `/${resolved}`;
  return `${siteOrigin()}${path}`;
}

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  if (typeof document === "undefined") return;
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel: string, href: string) {
  if (typeof document === "undefined") return;
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

function setJsonLd(id: string, data: Record<string, unknown> | Record<string, unknown>[] | null) {
  if (typeof document === "undefined") return;
  const scriptId = `seo-jsonld-${id}`;
  let el = document.getElementById(scriptId) as HTMLScriptElement | null;
  if (!data) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = scriptId;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

export type PageSeoInput = {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  type?: "website" | "article" | "product";
  noIndex?: boolean;
  keywords?: string;
};

export function applyPageSeo(input: PageSeoInput, settings?: Settings | null) {
  if (typeof document === "undefined") return;
  const brand = brandName(settings);
  const title = input.title.includes(brand) ? input.title : `${input.title} | ${brand}`;
  if (document.title !== title) document.title = title;

  const description = (input.description || DEFAULT_DESC).slice(0, 300);
  const canonical = `${siteOrigin()}${input.path.startsWith("/") ? input.path : `/${input.path}`}`;
  const image = absoluteUrl(
    input.image || settings?.logoUrl || settings?.ogImageUrl || "",
    settings,
  );

  upsertMeta("name", "description", description);
  upsertMeta("name", "robots", input.noIndex ? "noindex, nofollow" : "index, follow, max-image-preview:large");
  if (input.keywords) upsertMeta("name", "keywords", input.keywords);

  upsertLink("canonical", canonical);

  upsertMeta("property", "og:title", title);
  upsertMeta("property", "og:description", description);
  upsertMeta("property", "og:type", input.type || "website");
  upsertMeta("property", "og:url", canonical);
  upsertMeta("property", "og:site_name", brand);
  upsertMeta("property", "og:locale", "en_RW");
  if (image) upsertMeta("property", "og:image", image);

  upsertMeta("name", "twitter:card", image ? "summary_large_image" : "summary");
  upsertMeta("name", "twitter:title", title);
  upsertMeta("name", "twitter:description", description);
  if (image) upsertMeta("name", "twitter:image", image);
}

function organizationLd(settings?: Settings | null) {
  const brand = brandName(settings);
  const logo = settings?.logoUrl ? absoluteUrl(settings.logoUrl, settings) : undefined;
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: brand,
    url: siteOrigin(),
    logo: logo || undefined,
    email: settings?.email || undefined,
    telephone: settings?.phone || undefined,
    address: settings?.address
      ? {
          "@type": "PostalAddress",
          streetAddress: settings.address,
          addressLocality: "Kigali",
          addressCountry: "RW",
        }
      : undefined,
    sameAs: [settings?.facebookUrl, settings?.instagramUrl, settings?.twitterUrl].filter(Boolean),
  };
}

function websiteLd(settings?: Settings | null) {
  const brand = brandName(settings);
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: brand,
    url: siteOrigin(),
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteOrigin()}/restaurants?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

function restaurantLd(restaurant: Restaurant, settings?: Settings | null) {
  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: restaurant.name,
    description: restaurant.description || `${restaurant.name} on ${brandName(settings)}`,
    image: restaurant.coverUrl || restaurant.logoUrl
      ? absoluteUrl(String(restaurant.coverUrl || restaurant.logoUrl), settings)
      : undefined,
    url: `${siteOrigin()}/r/${restaurant.slug}`,
    servesCuisine: restaurant.type || "Rwandan",
    address: {
      "@type": "PostalAddress",
      streetAddress: restaurant.address,
      addressLocality: "Kigali",
      addressCountry: "RW",
    },
    openingHours: restaurant.openingHours || undefined,
  };
}

function dishLd(item: MenuItem, settings?: Settings | null) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: item.name,
    description: item.description || `${item.name} from ${item.restaurantName || brandName(settings)}`,
    image: item.imageUrl ? absoluteUrl(item.imageUrl, settings) : undefined,
    url: `${siteOrigin()}/dish/${item.id}`,
    offers: {
      "@type": "Offer",
      priceCurrency: "RWF",
      price: Number(item.price) || 0,
      availability: item.isAvailable
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
    brand: {
      "@type": "Brand",
      name: item.restaurantName || brandName(settings),
    },
  };
}

function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${siteOrigin()}${item.path}`,
    })),
  };
}

function pathOnly(loc: string) {
  return (loc.split("#")[0] || "/").split("?")[0] || "/";
}

/** Client-side SEO for the SPA — titles, meta, canonical, Open Graph, JSON-LD. */
export function SeoManager() {
  const [loc] = useLocation();
  const settings = useSettings();
  const catalog = useCatalog();
  const path = pathOnly(loc);

  useEffect(() => {
    const brand = brandName(settings);
    const restaurants = catalog?.restaurants || [];
    const items = catalog?.items || [];

    const noIndexPrivate =
      path.startsWith("/admin") ||
      path.startsWith("/vendor") ||
      path === "/cart" ||
      path === "/checkout" ||
      path === "/pay" ||
      path.startsWith("/pay/") ||
      path === "/login" ||
      path === "/register" ||
      path === "/verify-email" ||
      path === "/forgot-password" ||
      path === "/reset-password" ||
      path === "/waiting-approval" ||
      path === "/orders" ||
      path === "/profile";

    let title = `${brand} — food delivery in Kigali`;
    let description = DEFAULT_DESC;
    let image: string | null = settings?.logoUrl || null;
    let keywords =
      "food delivery Kigali, order food Rwanda, Kigali restaurants, Kigali Taste, delivery FRw";
    let pageType: PageSeoInput["type"] = "website";

    setJsonLd("org", organizationLd(settings));
    setJsonLd("website", websiteLd(settings));
    setJsonLd("entity", null);
    setJsonLd("breadcrumb", null);

    if (path === "/") {
      title = `${brand} — food delivered across Kigali`;
      description = `Hungry in Kigali? ${brand} delivers from local kitchens — browse restaurants, menus, Buy 1 Get 1 promos, and checkout in FRw.`;
      setJsonLd("breadcrumb", breadcrumbLd([{ name: "Home", path: "/" }]));
    } else if (path === "/restaurants") {
      title = `Restaurants in Kigali`;
      description = `Explore live restaurants on ${brand}. Find kitchens near you in Kigali and order delivery or pickup.`;
      keywords = "Kigali restaurants, food near me Kigali, order from restaurants Rwanda";
      setJsonLd(
        "breadcrumb",
        breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Restaurants", path: "/restaurants" },
        ]),
      );
    } else if (path === "/promos") {
      title = `Food promos & Buy 1 Get 1 offers`;
      description = `Current ${brand} promos in Kigali — Buy 1 Get 1 dish deals and coupon codes you can use at checkout.`;
      keywords = "food promo Kigali, buy 1 get 1 Kigali, restaurant offers Rwanda";
      setJsonLd(
        "breadcrumb",
        breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Promos", path: "/promos" },
        ]),
      );
    } else if (path === "/menu") {
      title = `Full menu — dishes in Kigali`;
      description = `Browse every live dish on ${brand}. Add meals from Kigali restaurants and get them delivered.`;
      setJsonLd(
        "breadcrumb",
        breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Menu", path: "/menu" },
        ]),
      );
    } else if (path === "/about") {
      title = `About ${brand}`;
      description = `Learn how ${brand} connects Kigali kitchens with hungry customers — local food delivery across the city.`;
    } else if (path === "/faq") {
      title = `FAQ — ordering & delivery`;
      description = `Answers about ordering food on ${brand}, delivery areas in Kigali, payments, and promotions.`;
    } else if (path === "/shipping") {
      title = `Shipping & delivery in Kigali`;
      description = `Delivery zones, fees, and pickup options for ${brand} food delivery in Kigali.`;
    } else if (path === "/contact") {
      title = `Contact ${brand}`;
      description = `Get in touch with ${brand} for support, partnerships, and restaurant onboarding in Kigali.`;
    } else if (path === "/profile") {
      title = `Your profile`;
      description = `Manage your ${brand} account details, profile photo, and password.`;
    } else if (path === "/become-a-partner") {
      title = `Become a restaurant partner`;
      description = `Join ${brand} as a vendor. List your kitchen, reach more customers in Kigali, and grow with food delivery.`;
    } else if (path.startsWith("/r/")) {
      const slug = path.slice(3);
      const restaurant = restaurants.find((r) => r.slug === slug);
      if (restaurant) {
        title = `${restaurant.name} menu`;
        description =
          restaurant.description?.trim() ||
          `Order from ${restaurant.name} (${restaurant.type}) on ${brand}. ${restaurant.address}. Delivery and pickup in Kigali.`;
        image = restaurant.coverUrl || restaurant.logoUrl || image;
        keywords = `${restaurant.name}, ${restaurant.type}, food delivery Kigali, ${brand}`;
        setJsonLd("entity", restaurantLd(restaurant, settings));
        setJsonLd(
          "breadcrumb",
          breadcrumbLd([
            { name: "Home", path: "/" },
            { name: "Restaurants", path: "/restaurants" },
            { name: restaurant.name, path: `/r/${restaurant.slug}` },
          ]),
        );
      }
    } else if (path.startsWith("/dish/")) {
      const id = Number(path.split("/")[2]);
      const item = items.find((i) => i.id === id);
      if (item) {
        title = `${item.name}${item.restaurantName ? ` — ${item.restaurantName}` : ""}`;
        description =
          item.description?.trim() ||
          `Order ${item.name} from ${item.restaurantName || "Kigali"} on ${brand}. Priced in FRw with delivery across Kigali.`;
        image = item.imageUrl || image;
        pageType = "product";
        keywords = `${item.name}, ${item.restaurantName || ""}, food delivery Kigali`.replace(/,\s*$/, "");
        setJsonLd("entity", dishLd(item, settings));
        setJsonLd(
          "breadcrumb",
          breadcrumbLd([
            { name: "Home", path: "/" },
            ...(item.restaurantSlug
              ? [
                  { name: "Restaurants", path: "/restaurants" },
                  { name: item.restaurantName || "Restaurant", path: `/r/${item.restaurantSlug}` },
                ]
              : [{ name: "Menu", path: "/menu" }]),
            { name: item.name, path: `/dish/${item.id}` },
          ]),
        );
      }
    } else if (noIndexPrivate) {
      title = brand;
      description = DEFAULT_DESC;
    }

    applyPageSeo(
      {
        title,
        description,
        path,
        image,
        type: pageType,
        noIndex: noIndexPrivate,
        keywords: noIndexPrivate ? undefined : keywords,
      },
      settings,
    );
  }, [loc, path, settings, catalog]);

  return null;
}
