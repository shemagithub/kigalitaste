import { count, many, one, run, now } from "./db.ts";

export type PromoCodeRow = {
  id: number;
  code: string;
  description: string;
  discountType: "PERCENT" | "FIXED";
  discountValue: number;
  minSubtotal: number;
  maxDiscount: number | null;
  firstOrderOnly: number;
  usageLimit: number | null;
  usedCount: number;
  isActive: number;
  restaurantId: number | null;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  restaurantName?: string | null;
  restaurantSlug?: string | null;
};

export type PromoApplyResult = {
  ok: boolean;
  error?: string;
  discount: number;
  promoCode: string | null;
  promoId: number | null;
  description?: string;
};

export type PublicPromoCard = {
  id: number;
  code: string;
  description: string;
  discountType: string;
  discountValue: number;
  minSubtotal: number;
  firstOrderOnly: boolean;
  headline: string;
  condition: string;
  restaurantId: number | null;
  restaurantName: string | null;
  restaurantSlug: string | null;
  scope: "ALL" | "RESTAURANT";
};

export async function ensurePromoTables() {
  await run(`CREATE TABLE IF NOT EXISTS promo_codes (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(40) NOT NULL,
    description VARCHAR(255) NOT NULL DEFAULT '',
    discountType VARCHAR(16) NOT NULL DEFAULT 'PERCENT',
    discountValue INT NOT NULL,
    minSubtotal INT NOT NULL DEFAULT 0,
    maxDiscount INT NULL,
    firstOrderOnly TINYINT NOT NULL DEFAULT 0,
    usageLimit INT NULL,
    usedCount INT NOT NULL DEFAULT 0,
    isActive TINYINT NOT NULL DEFAULT 1,
    restaurantId INT NULL,
    startsAt VARCHAR(40) NULL,
    endsAt VARCHAR(40) NULL,
    createdAt VARCHAR(40) NOT NULL,
    UNIQUE KEY promo_codes_code (code)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  try {
    await run("ALTER TABLE promo_codes ADD COLUMN restaurantId INT NULL");
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code !== "ER_DUP_FIELDNAME") throw err;
  }

  const existing = await one<{ n: number }>("SELECT COUNT(*) AS n FROM promo_codes");
  if (Number(existing?.n ?? 0) === 0) {
    await run(
      `INSERT INTO promo_codes(code, description, discountType, discountValue, minSubtotal, maxDiscount, firstOrderOnly, usageLimit, usedCount, isActive, restaurantId, startsAt, endsAt, createdAt)
       VALUES(?, ?, 'PERCENT', 20, 0, NULL, 1, NULL, 0, 1, NULL, NULL, NULL, ?)`,
      ["WELCOME20", "20% off your first order (from platform markup + delivery)", now()],
    );
  }
}

export async function listPromoCodes() {
  return many<PromoCodeRow>(
    `SELECT p.*, r.name AS restaurantName, r.slug AS restaurantSlug
     FROM promo_codes p
     LEFT JOIN restaurants r ON r.id = p.restaurantId
     ORDER BY p.id DESC`,
  );
}

export async function getPromoByCode(code: string) {
  return one<PromoCodeRow>(
    `SELECT p.*, r.name AS restaurantName, r.slug AS restaurantSlug
     FROM promo_codes p
     LEFT JOIN restaurants r ON r.id = p.restaurantId
     WHERE p.code = ?`,
    [code.trim().toUpperCase()],
  );
}

function withinWindow(promo: PromoCodeRow, when = new Date()) {
  if (promo.startsAt) {
    const start = new Date(promo.startsAt);
    if (!Number.isNaN(start.getTime()) && when < start) return false;
  }
  if (promo.endsAt) {
    const end = new Date(promo.endsAt);
    if (!Number.isNaN(end.getTime()) && when > end) return false;
  }
  return true;
}

export async function getFeaturedPromo() {
  const rows = await many<PromoCodeRow>(
    `SELECT p.*, r.name AS restaurantName, r.slug AS restaurantSlug
     FROM promo_codes p
     LEFT JOIN restaurants r ON r.id = p.restaurantId
     WHERE p.isActive = 1
     ORDER BY (p.restaurantId IS NULL) DESC, p.firstOrderOnly DESC, p.id ASC`,
  );
  return rows.find((row) => withinWindow(row)) || null;
}

export async function listPublicPromos() {
  const rows = await many<PromoCodeRow>(
    `SELECT p.*, r.name AS restaurantName, r.slug AS restaurantSlug
     FROM promo_codes p
     LEFT JOIN restaurants r ON r.id = p.restaurantId
     WHERE p.isActive = 1
     ORDER BY (p.restaurantId IS NULL) DESC, p.id DESC`,
  );
  return rows.filter((row) => withinWindow(row)).map((row) => publicPromoCard(row)!);
}

export async function listRestaurantPromos(restaurantId: number) {
  const rows = await many<PromoCodeRow>(
    `SELECT p.*, r.name AS restaurantName, r.slug AS restaurantSlug
     FROM promo_codes p
     LEFT JOIN restaurants r ON r.id = p.restaurantId
     WHERE p.isActive = 1
       AND (p.restaurantId IS NULL OR p.restaurantId = ?)
     ORDER BY (p.restaurantId IS NULL) ASC, p.id DESC`,
    [restaurantId],
  );
  return rows.filter((row) => withinWindow(row)).map((row) => publicPromoCard(row)!);
}

export async function applyPromoCode(opts: {
  code?: string | null;
  userId: number;
  foodSubtotal: number;
  platformAmount: number;
  restaurantId?: number | null;
  hardFail?: boolean;
}): Promise<PromoApplyResult> {
  const promo = String(opts.code || "").trim().toUpperCase();
  if (!promo) {
    return { ok: true, discount: 0, promoCode: null, promoId: null };
  }

  const row = await getPromoByCode(promo);
  if (!row || !Number(row.isActive)) {
    return {
      ok: false,
      error: "That promo code is not valid",
      discount: 0,
      promoCode: null,
      promoId: null,
    };
  }

  if (!withinWindow(row)) {
    return {
      ok: false,
      error: "This promo code is not active right now",
      discount: 0,
      promoCode: null,
      promoId: null,
    };
  }

  const promoRestaurantId = row.restaurantId != null ? Number(row.restaurantId) : null;
  if (promoRestaurantId != null) {
    if (!opts.restaurantId || Number(opts.restaurantId) !== promoRestaurantId) {
      const name = row.restaurantName || "that restaurant";
      return {
        ok: false,
        error: `${row.code} is only valid at ${name}`,
        discount: 0,
        promoCode: null,
        promoId: null,
      };
    }
  }

  if (row.usageLimit != null && Number(row.usedCount) >= Number(row.usageLimit)) {
    return {
      ok: false,
      error: "This promo code has reached its usage limit",
      discount: 0,
      promoCode: null,
      promoId: null,
    };
  }

  if (Number(row.firstOrderOnly)) {
    const previous = await count(
      "SELECT COUNT(*) AS n FROM orders WHERE customerId = ? AND status != 'CANCELLED'",
      [opts.userId],
    );
    if (previous > 0) {
      return {
        ok: false,
        error: `${row.code} is for your first order only`,
        discount: 0,
        promoCode: null,
        promoId: null,
      };
    }
  }

  const minSubtotal = Math.max(0, Number(row.minSubtotal) || 0);
  if (opts.foodSubtotal < minSubtotal) {
    return {
      ok: false,
      error: `Order food total must be at least ${minSubtotal.toLocaleString("en-RW")} FRw for ${row.code}`,
      discount: 0,
      promoCode: null,
      promoId: null,
    };
  }

  let discount = 0;
  if (row.discountType === "FIXED") {
    discount = Math.max(0, Number(row.discountValue) || 0);
  } else {
    const pct = Math.min(100, Math.max(0, Number(row.discountValue) || 0));
    discount = Math.round((opts.foodSubtotal * pct) / 100);
  }

  if (row.maxDiscount != null && Number(row.maxDiscount) > 0) {
    discount = Math.min(discount, Number(row.maxDiscount));
  }

  // Discount is funded from platform markup + delivery only (vendors keep menu base).
  discount = Math.min(discount, Math.max(0, opts.platformAmount));

  if (discount <= 0) {
    return {
      ok: false,
      error: "This promo cannot be applied to this order",
      discount: 0,
      promoCode: null,
      promoId: null,
    };
  }

  return {
    ok: true,
    discount,
    promoCode: row.code,
    promoId: row.id,
    description: row.description,
  };
}

export async function incrementPromoUsage(promoId: number | null | undefined) {
  if (!promoId) return;
  await run("UPDATE promo_codes SET usedCount = usedCount + 1 WHERE id = ?", [promoId]);
}

export function publicPromoCard(row: PromoCodeRow | null): PublicPromoCard | null {
  if (!row) return null;
  const percent = row.discountType === "PERCENT" ? Number(row.discountValue) : null;
  const fixed = row.discountType === "FIXED" ? Number(row.discountValue) : null;
  const restaurantId = row.restaurantId != null ? Number(row.restaurantId) : null;
  return {
    id: Number(row.id),
    code: row.code,
    description: row.description,
    discountType: row.discountType,
    discountValue: Number(row.discountValue),
    minSubtotal: Number(row.minSubtotal) || 0,
    firstOrderOnly: Boolean(Number(row.firstOrderOnly)),
    headline:
      percent != null
        ? `Get ${percent}% OFF`
        : `Get ${Math.round(fixed || 0).toLocaleString("en-RW")} FRw OFF`,
    condition: [
      restaurantId != null ? `at ${row.restaurantName || "this restaurant"}` : "all restaurants",
      row.firstOrderOnly ? "first order" : null,
      Number(row.minSubtotal) > 0
        ? `food total from ${Number(row.minSubtotal).toLocaleString("en-RW")} FRw`
        : null,
    ]
      .filter(Boolean)
      .join(" · ") || "Apply at checkout",
    restaurantId,
    restaurantName: row.restaurantName ? String(row.restaurantName) : null,
    restaurantSlug: row.restaurantSlug ? String(row.restaurantSlug) : null,
    scope: restaurantId != null ? "RESTAURANT" : "ALL",
  };
}
