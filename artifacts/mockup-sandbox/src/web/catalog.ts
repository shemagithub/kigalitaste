import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { type MenuItem, type Restaurant, type Settings } from "./customer";

export type Catalog = {
  restaurants: Restaurant[];
  items: MenuItem[];
};

const REV_KEY = "kt_catalog_rev";
const CATALOG_EVENT = "kt-catalog";

export function bumpCatalog() {
  try {
    localStorage.setItem(REV_KEY, String(Date.now()));
  } catch {
    /* ignore quota */
  }
  window.dispatchEvent(new Event(CATALOG_EVENT));
}

function money(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeItem(item: MenuItem): MenuItem {
  return {
    ...item,
    price: money(item.price),
    isAvailable: Boolean(item.isAvailable),
    promoActive: Boolean(item.promoActive),
    promoBuyQty: Math.max(1, Number(item.promoBuyQty) || 1),
    promoGetQty: Math.max(1, Number(item.promoGetQty) || 1),
    promoGetIds: Array.isArray(item.promoGetIds)
      ? item.promoGetIds.map(Number).filter((n) => Number.isFinite(n) && n > 0)
      : [],
  };
}

let catalogCache: Catalog | null = null;
let settingsCache: Settings | null = null;
let catalogInflight: Promise<Catalog> | null = null;
let liveStarted = false;
const catalogListeners = new Set<(data: Catalog) => void>();
const settingsListeners = new Set<(data: Settings) => void>();

function publishCatalog(data: Catalog) {
  catalogCache = data;
  catalogListeners.forEach((fn) => fn(data));
}

function publishSettings(data: Settings) {
  settingsCache = data;
  settingsListeners.forEach((fn) => fn(data));
}

export async function refreshCatalog() {
  if (catalogInflight) return catalogInflight;
  catalogInflight = api<Catalog>("/api/catalog")
    .then((data) => {
      const next: Catalog = {
        restaurants: data.restaurants || [],
        items: (data.items || []).map(normalizeItem),
      };
      publishCatalog(next);
      return next;
    })
    .catch((err) => {
      console.warn("[catalog] refresh failed:", err instanceof Error ? err.message : err);
      if (catalogCache) return catalogCache;
      const empty: Catalog = { restaurants: [], items: [] };
      publishCatalog(empty);
      return empty;
    })
    .finally(() => {
      catalogInflight = null;
    });
  return catalogInflight;
}

export async function refreshSettings() {
  try {
    const data = await api<Settings>("/api/settings");
    publishSettings(data);
    return data;
  } catch (err) {
    console.warn("[settings] refresh failed:", err instanceof Error ? err.message : err);
    if (settingsCache) return settingsCache;
    return {};
  }
}

function safeRefreshCatalog() {
  void refreshCatalog();
}

function safeRefreshSettings() {
  void refreshSettings();
}

function startLiveCatalog() {
  if (liveStarted || typeof window === "undefined") return;
  liveStarted = true;
  safeRefreshCatalog();
  safeRefreshSettings();
  const onShow = () => {
    if (document.visibilityState !== "visible") return;
    safeRefreshCatalog();
    safeRefreshSettings();
  };
  window.addEventListener("focus", onShow);
  document.addEventListener("visibilitychange", onShow);
  window.addEventListener(CATALOG_EVENT, onShow);
  window.addEventListener("storage", (e) => {
    if (e.key === REV_KEY) onShow();
  });
  window.setInterval(onShow, 8000);
}

export function useCatalog() {
  const [data, setData] = useState<Catalog | null>(catalogCache);
  useEffect(() => {
    startLiveCatalog();
    const sub = (next: Catalog) => setData(next);
    catalogListeners.add(sub);
    if (catalogCache) setData(catalogCache);
    else safeRefreshCatalog();
    return () => {
      catalogListeners.delete(sub);
    };
  }, []);
  return data;
}

export function useSettings(initial: Settings = {}) {
  const [data, setData] = useState<Settings>(settingsCache || initial);
  useEffect(() => {
    startLiveCatalog();
    const sub = (next: Settings) => setData(next);
    settingsListeners.add(sub);
    if (settingsCache) setData(settingsCache);
    else safeRefreshSettings();
    return () => {
      settingsListeners.delete(sub);
    };
  }, []);

  useEffect(() => {
    void import("./ui").then(({ applyBrandAssets }) => applyBrandAssets(data));
  }, [data.logoUrl, data.faviconUrl, data.platformName]);

  return data;
}
