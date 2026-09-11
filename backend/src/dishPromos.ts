import { many, one } from "./db.ts";

export type DishPromoMenuRow = {
  id: number;
  restaurantId: number;
  name: string;
  basePrice: number;
  adminMarkup: number;
  isAvailable: number;
  promoActive: number;
  promoType: string | null;
  promoBuyQty: number | null;
  promoGetQty: number | null;
  promoGetIds: string | null;
};

export type CheckoutCartLine = {
  menuItemId: number;
  qty: number;
  isFree?: boolean;
  promoTriggerMenuItemId?: number | null;
};

export function parsePromoGetIds(raw: unknown): number[] {
  if (raw == null || raw === "") return [];
  if (Array.isArray(raw)) {
    return raw.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0);
  }
  try {
    const parsed = JSON.parse(String(raw));
    if (Array.isArray(parsed)) {
      return parsed.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0);
    }
  } catch {
    /* ignore */
  }
  return String(raw)
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export function serializePromoGetIds(ids: unknown): string | null {
  const list = parsePromoGetIds(ids);
  return list.length ? JSON.stringify(list) : null;
}

export function isBogoActive(item: {
  promoActive?: number | boolean | null;
  promoType?: string | null;
}) {
  return Boolean(Number(item.promoActive)) && String(item.promoType || "").toUpperCase() === "BOGO";
}

export function bogoLabel(buyQty = 1, getQty = 1) {
  const buy = Math.max(1, Number(buyQty) || 1);
  const get = Math.max(1, Number(getQty) || 1);
  return buy === 1 && get === 1 ? "Buy 1 Get 1" : `Buy ${buy} Get ${get}`;
}

export function publicDishPromo(item: DishPromoMenuRow | Record<string, unknown>) {
  if (!isBogoActive(item as { promoActive?: unknown; promoType?: string | null })) {
    return {
      promoActive: false,
      promoType: null as string | null,
      promoBuyQty: 1,
      promoGetQty: 1,
      promoGetIds: [] as number[],
      promoLabel: null as string | null,
    };
  }
  const buyQty = Math.max(1, Number(item.promoBuyQty) || 1);
  const getQty = Math.max(1, Number(item.promoGetQty) || 1);
  return {
    promoActive: true,
    promoType: "BOGO",
    promoBuyQty: buyQty,
    promoGetQty: getQty,
    promoGetIds: parsePromoGetIds(item.promoGetIds),
    promoLabel: bogoLabel(buyQty, getQty),
  };
}

export function normalizePromoWrite(body: Record<string, unknown> | null | undefined, existing?: DishPromoMenuRow | null) {
  const raw = body || {};
  const hasPromoField =
    raw.promoActive !== undefined ||
    raw.promoType !== undefined ||
    raw.promoBuyQty !== undefined ||
    raw.promoGetQty !== undefined ||
    raw.promoGetIds !== undefined;

  if (!hasPromoField && existing) {
    return {
      promoActive: Number(existing.promoActive) ? 1 : 0,
      promoType: existing.promoType,
      promoBuyQty: Math.max(1, Number(existing.promoBuyQty) || 1),
      promoGetQty: Math.max(1, Number(existing.promoGetQty) || 1),
      promoGetIds: existing.promoGetIds,
    };
  }

  const promoActive =
    raw.promoActive === undefined
      ? 0
      : raw.promoActive === true ||
          raw.promoActive === 1 ||
          raw.promoActive === "1" ||
          raw.promoActive === "true"
        ? 1
        : 0;
  if (!promoActive) {
    return {
      promoActive: 0,
      promoType: null as string | null,
      promoBuyQty: 1,
      promoGetQty: 1,
      promoGetIds: null as string | null,
    };
  }

  return {
    promoActive: 1,
    promoType: "BOGO",
    promoBuyQty: Math.max(1, Number(raw.promoBuyQty) || 1),
    promoGetQty: Math.max(1, Number(raw.promoGetQty) || 1),
    promoGetIds: serializePromoGetIds(raw.promoGetIds),
  };
}

/** Resolve paid/free lines for checkout — free lines are 0 price when valid BOGO. */
export async function resolveCheckoutLines(
  restaurantId: number,
  rawItems: CheckoutCartLine[],
): Promise<
  {
    menuItemId: number;
    name: string;
    base: number;
    markup: number;
    qty: number;
    isFree: boolean;
    promoTriggerMenuItemId: number | null;
  }[]
> {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new Error("Your cart is empty");
  }

  const paidInput = rawItems.filter((l) => !l.isFree);
  const freeInput = rawItems.filter((l) => l.isFree);

  const resolved: {
    menuItemId: number;
    name: string;
    base: number;
    markup: number;
    qty: number;
    isFree: boolean;
    promoTriggerMenuItemId: number | null;
  }[] = [];

  const paidByTrigger = new Map<number, number>();

  for (const line of paidInput) {
    const item = await one<DishPromoMenuRow>(
      "SELECT * FROM menu_items WHERE id = ? AND restaurantId = ?",
      [line.menuItemId, restaurantId],
    );
    if (!item || !Number(item.isAvailable)) {
      throw new Error("An item is no longer available");
    }
    const qty = Math.max(1, Number(line.qty) || 1);
    paidByTrigger.set(item.id, (paidByTrigger.get(item.id) || 0) + qty);
    resolved.push({
      menuItemId: item.id,
      name: item.name,
      base: Number(item.basePrice) || 0,
      markup: Number(item.adminMarkup) || 0,
      qty,
      isFree: false,
      promoTriggerMenuItemId: null,
    });
  }

  const freeAllowedByTrigger = new Map<number, number>();
  for (const [triggerId, paidQty] of paidByTrigger) {
    const trigger = await one<DishPromoMenuRow>("SELECT * FROM menu_items WHERE id = ?", [triggerId]);
    if (!trigger || !isBogoActive(trigger)) continue;
    const buyQty = Math.max(1, Number(trigger.promoBuyQty) || 1);
    const getQty = Math.max(1, Number(trigger.promoGetQty) || 1);
    freeAllowedByTrigger.set(triggerId, Math.floor(paidQty / buyQty) * getQty);
  }

  const freeUsedByTrigger = new Map<number, number>();

  for (const line of freeInput) {
    const triggerId = Number(line.promoTriggerMenuItemId) || 0;
    if (!triggerId) {
      throw new Error("Free promo item is missing its paid dish");
    }
    const trigger = await one<DishPromoMenuRow>(
      "SELECT * FROM menu_items WHERE id = ? AND restaurantId = ?",
      [triggerId, restaurantId],
    );
    if (!trigger || !isBogoActive(trigger)) {
      throw new Error("That buy-1-get-1 offer is no longer active");
    }

    const freeItem = await one<DishPromoMenuRow>(
      "SELECT * FROM menu_items WHERE id = ? AND restaurantId = ?",
      [line.menuItemId, restaurantId],
    );
    if (!freeItem || !Number(freeItem.isAvailable)) {
      throw new Error("A free promo dish is no longer available");
    }

    const allowedIds = parsePromoGetIds(trigger.promoGetIds);
    const okFree =
      allowedIds.length === 0
        ? freeItem.id === trigger.id
        : allowedIds.includes(freeItem.id);
    if (!okFree) {
      throw new Error(`${freeItem.name} is not part of the ${trigger.name} promo`);
    }

    const qty = Math.max(1, Number(line.qty) || 1);
    const used = (freeUsedByTrigger.get(triggerId) || 0) + qty;
    const allowed = freeAllowedByTrigger.get(triggerId) || 0;
    if (used > allowed) {
      throw new Error(
        `Too many free items for ${trigger.name}. Buy more to unlock extra free dishes.`,
      );
    }
    freeUsedByTrigger.set(triggerId, used);

    resolved.push({
      menuItemId: freeItem.id,
      name: `${freeItem.name} (Free promo)`,
      base: 0,
      markup: 0,
      qty,
      isFree: true,
      promoTriggerMenuItemId: triggerId,
    });
  }

  return resolved;
}

export async function listBogoItemsForRestaurant(restaurantId: number) {
  return many<DishPromoMenuRow>(
    `SELECT * FROM menu_items
     WHERE restaurantId = ? AND isAvailable = 1 AND promoActive = 1 AND promoType = 'BOGO'
     ORDER BY id DESC`,
    [restaurantId],
  );
}
