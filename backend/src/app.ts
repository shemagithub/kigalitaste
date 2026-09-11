import express, { type Request, type Response } from "express";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HERO_SETTING_KEYS, UPLOAD_KIND_TO_SETTING } from "./heroDefaults.ts";
import { ABOUT_SETTING_KEYS } from "./aboutDefaults.ts";
import { FAQ_SETTING_KEYS } from "./faqDefaults.ts";
import { SHIPPING_SETTING_KEYS } from "./shippingDefaults.ts";
import { NEWSLETTER_SETTING_KEYS } from "./newsletterDefaults.ts";
import {
  getFeaturedPromo,
  incrementPromoUsage,
  listPromoCodes,
  listPublicPromos,
  listRestaurantPromos,
  publicPromoCard,
  type PromoCodeRow,
} from "./promoCodes.ts";
import { computeCheckoutPreview, resolveOrderTotals } from "./checkoutTotals.ts";
import {
  normalizePromoWrite,
  publicDishPromo,
  resolveCheckoutLines,
} from "./dishPromos.ts";
import {
  listDeliveryZones,
  resolveDeliveryQuote,
  type DeliveryZoneRow,
} from "./deliveryZones.ts";
import cors from "cors";
import bcrypt from "bcryptjs";
import {
  consumeCode,
  createCode,
  creditWalletsIfNeeded,
  count,
  deleteOrderById,
  many,
  nextOrderNumber,
  now,
  one,
  pendingPayouts,
  pendingPlatformEarnings,
  pendingVendorEarnings,
  platformCommission,
  run,
  setSetting,
  setting,
  syncDeliveredWalletCredits,
  platformTransactionFeed,
  vendorTransactionFeed,
  uniqueSlug,
  uploadsDir,
  walletBalance,
  walletStats,
} from "./db.ts";
import {
  publicUser,
  requireAuth,
  requireRole,
  signToken,
  vendorRow,
  type AuthUser,
} from "./auth.ts";
import { fileUrl, upload, mailUpload } from "./upload.ts";
import { sendVerificationEmail, sendPasswordResetEmail, notifyOrderPaidSafe, notifyOrderPlacedSafe, notifyOrderStatusSafe, sendMailboxEmail, notifyBusinessInbox, businessNotifyEmail } from "./mail.ts";
import { mailboxSyncStatus, syncMailboxInboxSafe } from "./mailboxSync.ts";
import {
  attachmentCanPreview,
  attachmentFilePath,
  getMailboxAttachment,
  listAttachmentsForMessages,
  saveUploadedAttachments,
} from "./mailboxAttachments.ts";
import { MulterError } from "multer";
import {
  consumeNameDraft,
  initiatePayout,
  lookupMomoName,
  namesMatch,
  peekNameDraft,
  preparePayout,
  paymentsConfigured,
  payoutReference,
  processWebhookEvent,
  PROVIDERS,
  publicAppUrl,
  paymentPublicUrl,
  refreshOrderPayment,
  refreshPayout,
  rwandaPhones,
  startCardCheckoutPayment,
  startWalletCollectionPayment,
  verifyWebhookSignature,
} from "./xentripay.ts";

const app = express();
app.set("etag", false);
app.use(cors({ origin: true, credentials: true }));
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
  }
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "kigali-taste-api" });
});

app.post("/api/webhooks/xentripay", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(String(req.body || ""), "utf8");
    const secret = process.env.XENTRIPAY_WEBHOOK_SECRET || "";
    const signature = String(req.headers["x-xentripay-signature"] || "");
    if (secret && !verifyWebhookSignature(raw, secret, signature)) {
      res.status(401).json({ error: "Invalid signature" });
      return;
    }
    const payload = JSON.parse(raw.toString("utf8") || "{}") as {
      event?: string;
      data?: Record<string, unknown>;
      idempotencyKey?: string;
    };
    const key = String(payload.idempotencyKey || req.headers["x-xentripay-idempotency-key"] || "");
    if (key) {
      const seen = await one("SELECT idempotencyKey FROM webhook_events WHERE idempotencyKey = ?", [key]);
      if (seen) {
        res.status(200).json({ received: true, duplicate: true });
        return;
      }
      await run("INSERT INTO webhook_events(idempotencyKey, event, createdAt) VALUES(?, ?, ?)", [
        key,
        String(payload.event || "unknown"),
        now(),
      ]);
    }
    await processWebhookEvent(payload);
    res.status(200).json({ received: true });
  } catch (err) {
    console.error("XentriPay webhook error", err);
    res.status(200).json({ received: true });
  }
});

app.use(express.json({ limit: "2mb" }));
app.use(
  "/uploads",
  express.static(uploadsDir, {
    setHeaders(res, filePath) {
      const lower = filePath.toLowerCase();
      if (lower.endsWith(".pdf")) {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "inline");
      } else if (/\.(jpe?g|png|webp|gif)$/.test(lower)) {
        res.setHeader("Content-Disposition", "inline");
      }
    },
  }),
);

function fail(res: Response, status: number, error: string) {
  res.status(status).json({ error });
}

function parseEmailList(raw: unknown): string[] {
  const text = String(raw || "").trim();
  if (!text) return [];
  const out: string[] = [];
  for (const part of text.split(/[,;]/)) {
    const match = part.match(/<([^>]+@[^>]+)>/);
    const email = (match ? match[1] : part).trim().toLowerCase();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) out.push(email);
  }
  return [...new Set(out)];
}

function mailAttachmentPayload(files?: Express.Multer.File[]) {
  return (files || []).map((f) => ({
    filename: f.originalname,
    content: f.buffer,
    contentType: f.mimetype,
  }));
}

async function settingsMap() {
  const rows = await many<{ key: string; value: string }>("SELECT setting_key AS `key`, value FROM settings");
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

function money(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function customerPrice(base: unknown, markup: unknown) {
  return money(base) + money(markup);
}

type MenuRow = {
  id: number;
  restaurantId: number;
  categoryId: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  basePrice: number;
  adminMarkup: number;
  isAvailable: number;
  promoActive?: number;
  promoType?: string | null;
  promoBuyQty?: number | null;
  promoGetQty?: number | null;
  promoGetIds?: string | null;
  categoryName?: string;
};

function asCustomerItem(item: MenuRow) {
  const promo = publicDishPromo(item);
  return {
    id: item.id,
    categoryId: item.categoryId,
    categoryName: item.categoryName,
    name: item.name,
    description: item.description,
    imageUrl: item.imageUrl,
    price: customerPrice(item.basePrice, item.adminMarkup),
    isAvailable: Boolean(Number(item.isAvailable)),
    ...promo,
  };
}

function asVendorItem(item: MenuRow) {
  const promo = publicDishPromo(item);
  return {
    id: item.id,
    categoryId: item.categoryId,
    categoryName: item.categoryName,
    name: item.name,
    description: item.description,
    imageUrl: item.imageUrl,
    basePrice: money(item.basePrice),
    isAvailable: Boolean(Number(item.isAvailable)),
    ...promo,
  };
}

function asAdminItem(item: MenuRow) {
  const promo = publicDishPromo(item);
  return {
    id: item.id,
    categoryId: item.categoryId,
    categoryName: item.categoryName,
    name: item.name,
    description: item.description,
    imageUrl: item.imageUrl,
    basePrice: money(item.basePrice),
    adminMarkup: money(item.adminMarkup),
    customerPrice: customerPrice(item.basePrice, item.adminMarkup),
    isAvailable: Boolean(Number(item.isAvailable)),
    ...promo,
  };
}

function remoteImageUrl(raw: unknown) {
  const value = String(raw || "").trim();
  if (!value) return "";
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return value;
  } catch {
    return "";
  }
}

async function dispatchPayout(payoutId: number, recipientName?: string) {
  const payout = await one<{
    id: number;
    amount: number;
    status: string;
    msisdn: string | null;
    recipientName: string | null;
    telecomProviderId: string | null;
  }>("SELECT * FROM payout_requests WHERE id = ?", [payoutId]);
  if (!payout || (payout.status !== "REQUESTED" && payout.status !== "FAILED")) {
    throw new Error("Payout is not waiting");
  }
  if (!paymentsConfigured()) {
    throw new Error("XentriPay is not configured");
  }
  if (payout.amount < 100) {
    throw new Error("XentriPay payouts need at least 100 FRw");
  }
  if (!payout.msisdn) {
    throw new Error("This payout has no MoMo number");
  }
  const ready = preparePayout(payout.msisdn, payout.amount, payout.telecomProviderId || "");
  const name = String(recipientName || payout.recipientName || "").trim();
  if (!name) {
    throw new Error("Validate the registered name before sending");
  }
  const draft = consumeNameDraft(ready.local, ready.amount, ready.providerId);
  const sendName = draft?.name || name;
  const customerReference = draft?.customerReference || payoutReference();
  const sent = draft?.customerReference
    ? {
        customerReference: draft.customerReference,
        internalRef: draft.internalRef,
        status: draft.status,
        statusMessage: draft.statusMessage,
        validatedAccountName: draft.name,
      }
    : await initiatePayout({
        customerReference,
        telecomProviderId: ready.providerId,
        msisdn: ready.local,
        name: sendName,
        amount: ready.amount,
      });
  const confirmedName = String(sent.validatedAccountName || draft?.name || name).trim();
  const note =
    sent.statusMessage ||
    "Payment request submitted. Confirm the OTP sent to the XentriPay business email or phone.";
  await run(
    `UPDATE payout_requests SET status = 'SENDING', recipientName = ?, customerReference = ?, internalRef = ?, xentriStatus = ?, adminNote = ? WHERE id = ?`,
    [
      confirmedName,
      sent.customerReference || customerReference,
      sent.internalRef || null,
      sent.status || "PENDING",
      note,
      payout.id,
    ],
  );
  return {
    ok: true,
    id: payout.id,
    status: "SENDING" as const,
    xentriStatus: sent.status || "PENDING",
    customerReference: sent.customerReference || customerReference,
    validatedAccountName: confirmedName,
    message: note,
  };
}

function requireMatchedPayoutName(local: string, amount: number, providerId: string, recipientName: string) {
  const draft = peekNameDraft(local, amount, providerId);
  if (!draft?.name) {
    throw new Error("Validate the registered name before sending");
  }
  const typed = String(recipientName || "").trim();
  if (typed && !namesMatch(typed, draft.name)) {
    throw new Error(`This number is registered to ${draft.name}. Validate again before sending.`);
  }
  return draft.name;
}

async function startCustomerPayment(opts: {
  orderId: number;
  orderNumber: string;
  amount: number;
  method: "MOMO" | "AIRTEL" | "CARD";
  user: AuthUser;
  phone: string;
}) {
  const phones = rwandaPhones(opts.phone);
  const amount = Math.round(opts.amount);
  if (amount < 100) {
    throw new Error("Amount must be at least 100 RWF");
  }

  if (opts.method === "CARD") {
    const card = await startCardCheckoutPayment({
      orderId: opts.orderId,
      orderNumber: opts.orderNumber,
      amount,
      user: opts.user,
      phone: opts.phone,
    });
    await run(
      "UPDATE orders SET paymentRef = ?, paymentTid = ?, checkoutSessionId = ?, paymentUrl = ?, customerPhone = ? WHERE id = ?",
      [card.refid, card.tid, card.sessionId, card.gatewayUrl, phones.local, opts.orderId],
    );
    return {
      method: opts.method,
      status: "PENDING" as const,
      message: card.message,
      refid: card.refid,
      gatewayUrl: card.gatewayUrl,
      checkoutUrl: card.gatewayUrl,
    };
  }

  const wallet = await startWalletCollectionPayment({
    orderNumber: opts.orderNumber,
    amount,
    user: opts.user,
    phone: opts.phone,
    method: opts.method,
  });
  await run(
    "UPDATE orders SET paymentRef = ?, paymentTid = ?, checkoutSessionId = ?, paymentUrl = ?, customerPhone = ? WHERE id = ?",
    [wallet.refid, wallet.tid, wallet.sessionId, wallet.gatewayUrl, phones.local, opts.orderId],
  );
  return {
    method: opts.method,
    status: "PENDING" as const,
    message: wallet.message,
    refid: wallet.refid,
    gatewayUrl: wallet.gatewayUrl || undefined,
    checkoutUrl: wallet.gatewayUrl || undefined,
  };
}

app.get("/api/health", async (_req, res) => {
  try {
    await one("SELECT 1 AS n");
    res.json({ ok: true, db: "up" });
  } catch (err) {
    console.error("Health check failed", err);
    res.status(503).json({ ok: false, db: "down" });
  }
});

app.get("/robots.txt", (_req, res) => {
  const base = publicAppUrl();
  res.type("text/plain").send(
    [
      "User-agent: *",
      "Allow: /",
      "Disallow: /admin",
      "Disallow: /vendor",
      "Disallow: /cart",
      "Disallow: /checkout",
      "Disallow: /pay",
      "Disallow: /login",
      "Disallow: /register",
      "Disallow: /orders",
      "Disallow: /profile",
      "Disallow: /verify-email",
      "Disallow: /forgot-password",
      "Disallow: /reset-password",
      "Disallow: /waiting-approval",
      `Sitemap: ${base}/sitemap.xml`,
      "",
    ].join("\n"),
  );
});

app.get("/sitemap.xml", async (_req, res) => {
  try {
    const base = publicAppUrl();
    const now = new Date().toISOString();
    const staticPaths = [
      { path: "/", priority: "1.0", changefreq: "daily" },
      { path: "/restaurants", priority: "0.9", changefreq: "daily" },
      { path: "/menu", priority: "0.8", changefreq: "daily" },
      { path: "/promos", priority: "0.8", changefreq: "daily" },
      { path: "/about", priority: "0.5", changefreq: "monthly" },
      { path: "/faq", priority: "0.5", changefreq: "monthly" },
      { path: "/shipping", priority: "0.5", changefreq: "monthly" },
      { path: "/contact", priority: "0.4", changefreq: "monthly" },
      { path: "/become-a-partner", priority: "0.6", changefreq: "monthly" },
    ];

    const restaurants = await many<{ slug: string }>(
      `SELECT r.slug FROM restaurants r
       JOIN vendors v ON v.id = r.vendorId
       WHERE r.isLive = 1 AND v.status = 'APPROVED' AND v.suspended = 0
       ORDER BY r.name`,
    );
    const dishes = await many<{ id: number }>(
      `SELECT m.id FROM menu_items m
       JOIN restaurants r ON r.id = m.restaurantId
       JOIN vendors v ON v.id = r.vendorId
       WHERE m.isAvailable = 1 AND r.isLive = 1 AND v.status = 'APPROVED' AND v.suspended = 0
       ORDER BY m.id DESC
       LIMIT 5000`,
    );

    const urls = [
      ...staticPaths.map(
        (p) => `  <url>
    <loc>${base}${p.path}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`,
      ),
      ...restaurants.map(
        (r) => `  <url>
    <loc>${base}/r/${encodeURIComponent(r.slug)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`,
      ),
      ...dishes.map(
        (d) => `  <url>
    <loc>${base}/dish/${d.id}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`,
      ),
    ];

    res.type("application/xml").send(
      `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>
`,
    );
  } catch (err) {
    console.error("sitemap.xml failed", err);
    res.status(500).type("text/plain").send("Sitemap unavailable");
  }
});

app.get("/api/payments/config", async (_req, res) => {
  let cardReady = false;
  try {
    const host = new URL(paymentPublicUrl()).hostname;
    cardReady = paymentsConfigured() && !/^(localhost|127\.0\.0\.1)$/i.test(host);
  } catch {
    cardReady = false;
  }
  res.json({
    configured: paymentsConfigured(),
    currency: "RWF",
    providers: PROVIDERS,
    publicAppUrl: publicAppUrl(),
    paymentReturnUrl: paymentPublicUrl(),
    cardReady,
  });
});

app.get("/api/settings", async (_req, res) => {
  const zones = await listDeliveryZones(true);
  res.json({
    ...(await settingsMap()),
    email: businessNotifyEmail(),
    deliveryZones: zones.map((z) => ({ id: z.id, name: z.name, fee: z.fee, keywords: z.keywords || "" })),
    deliveryFrom: zones.length ? Math.min(...zones.map((z) => z.fee)) : Number(await setting("deliveryFee", "1500")),
  });
});

/** Stable favicon URL for the customer site (works across kigalitaste.co → backend subdomain). */
app.get("/api/brand/icon", async (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=120");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const favicon = String(await setting("faviconUrl", "")).trim();
  const logo = String(await setting("logoUrl", "")).trim();
  const raw = favicon || logo;

  if (/^https?:\/\//i.test(raw)) {
    res.redirect(302, raw);
    return;
  }

  if (raw.startsWith("/uploads/") || raw.startsWith("uploads/")) {
    const filename = path.basename(raw.split("?")[0]);
    if (/^[\w.-]+$/i.test(filename)) {
      const filePath = path.join(uploadsDir, filename);
      if (existsSync(filePath)) {
        res.sendFile(filePath);
        return;
      }
    }
  }

  const platform = String(await setting("platformName", "Kigali Taste")).trim() || "Kigali Taste";
  const parts = platform.split(/\s+/).filter(Boolean);
  const initials = (
    parts.length >= 2 ? `${parts[0][0] || ""}${parts[1][0] || ""}` : platform.slice(0, 2)
  )
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 2) || "KT";

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${platform.replace(/"/g, "")}">
  <rect width="64" height="64" rx="14" fill="#0d4f46"/>
  <text x="32" y="40" text-anchor="middle" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="22" font-weight="700" fill="#ffffff">${initials}</text>
</svg>`;
  res.type("image/svg+xml").send(svg);
});

app.get("/api/delivery-zones", async (_req, res) => {
  const zones = await listDeliveryZones(true);
  res.json(
    zones.map((z) => ({
      id: z.id,
      name: z.name,
      fee: z.fee,
      keywords: z.keywords,
    })),
  );
});

app.post("/api/delivery/quote", async (req, res) => {
  const address = String(req.body?.address || "").trim();
  const zoneId = req.body?.zoneId ?? req.body?.deliveryZoneId;
  if (!address && !zoneId) {
    fail(res, 400, "Select a sector or enter a delivery location in Kigali");
    return;
  }
  res.json(
    await resolveDeliveryQuote(
      address || "Kigali",
      req.body?.lat ?? req.body?.deliveryLat,
      req.body?.lng ?? req.body?.deliveryLng,
      zoneId,
    ),
  );
});

app.get("/api/locations/search", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (q.length < 2) {
    res.json([]);
    return;
  }
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=8&countrycodes=rw&q=${encodeURIComponent(`${q}, Kigali, Rwanda`)}`;
    const response = await fetch(url, {
      headers: { "User-Agent": "KigaliTasteFoodDelivery/1.0 (delivery@kigalitaste.rw)" },
    });
    if (!response.ok) {
      res.json([]);
      return;
    }
    const rows = (await response.json()) as {
      display_name: string;
      lat: string;
      lon: string;
    }[];
    res.json(
      rows.map((row) => ({
        label: row.display_name,
        address: row.display_name,
        lat: Number(row.lat),
        lng: Number(row.lon),
      })),
    );
  } catch {
    res.json([]);
  }
});

app.get("/api/locations/reverse", async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    fail(res, 400, "Invalid GPS coordinates");
    return;
  }
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const response = await fetch(url, {
      headers: { "User-Agent": "KigaliTasteFoodDelivery/1.0 (delivery@kigalitaste.rw)" },
    });
    if (!response.ok) {
      fail(res, 502, "Could not read your location from GPS");
      return;
    }
    const row = (await response.json()) as { display_name?: string };
    const address = String(row.display_name || "").trim();
    res.json({
      label: address || "Current location",
      address: address || `Near ${lat.toFixed(5)}, ${lng.toFixed(5)}, Kigali`,
      lat,
      lng,
    });
  } catch {
    fail(res, 502, "Could not read your location from GPS");
  }
});

app.post("/api/auth/register", async (req, res) => {
  const { firstName, lastName, email, phone, password, confirmPassword } = req.body ?? {};
  if (!firstName || !lastName || !email || !phone || !password) {
    fail(res, 400, "Fill in all fields");
    return;
  }
  if (password !== confirmPassword) {
    fail(res, 400, "Passwords do not match");
    return;
  }
  if (String(password).length < 6) {
    fail(res, 400, "Password must be at least 6 characters");
    return;
  }
  const emailNorm = String(email).toLowerCase().trim();
  if (await one("SELECT id FROM users WHERE email = ?", [emailNorm])) {
    fail(res, 400, "That email is already registered");
    return;
  }
  const created = await run(
    `INSERT INTO users(role, firstName, lastName, email, phone, passwordHash, emailVerified, createdAt)
     VALUES('customer', ?, ?, ?, ?, ?, 0, ?)`,
    [firstName, lastName, emailNorm, phone, bcrypt.hashSync(password, 10), now()],
  );
  const code = await createCode(emailNorm, "register");
  let emailed = true;
  try {
    await sendVerificationEmail(emailNorm, code);
  } catch (err) {
    console.error("Failed to send verification email", err);
    emailed = false;
  }
  const user = await one<AuthUser>("SELECT * FROM users WHERE id = ?", [
    Number(created.lastInsertRowid),
  ]);
  res.json({
    message: emailed
      ? "Check your email for a 6-digit code"
      : "Account created. We could not send email — tap Resend code again.",
    email: emailNorm,
    emailed,
    token: user ? signToken(user) : undefined,
    user: user ? publicUser(user) : undefined,
  });
});

app.post("/api/auth/verify-email", async (req, res) => {
  const email = String(req.body?.email ?? "").toLowerCase().trim();
  const code = String(req.body?.code ?? "").trim();
  if (!await consumeCode(email, code, "register") && !await consumeCode(email, code, "partner")) {
    fail(res, 400, "That code is wrong or expired");
    return;
  }
  await run("UPDATE users SET emailVerified = 1 WHERE email = ?", [email]);
  const vendor = await one<{ id: number; status: string }>(
    `SELECT v.id, v.status FROM vendors v JOIN users u ON u.id = v.userId WHERE u.email = ?`,
    [email],
  );
  if (vendor && vendor.status === "PENDING_EMAIL") {
    await run("UPDATE vendors SET status = 'PENDING_APPROVAL' WHERE id = ?", [vendor.id]);
  }
  const user = await one<AuthUser>("SELECT * FROM users WHERE email = ?", [email]);
  res.json({
    ok: true,
    vendorStatus: vendor
      ? vendor.status === "PENDING_EMAIL"
        ? "PENDING_APPROVAL"
        : vendor.status
      : undefined,
    token: user ? signToken(user) : undefined,
    user: user ? publicUser(user) : undefined,
  });
});

app.post("/api/auth/resend-code", async (req, res) => {
  const email = String(req.body?.email ?? "").toLowerCase().trim();
  const user = await one<AuthUser>("SELECT * FROM users WHERE email = ?", [email]);
  if (!user) {
    fail(res, 404, "No account with that email");
    return;
  }
  const purpose = user.role === "vendor" ? "partner" : "register";
  const code = await createCode(email, purpose);
  try {
    await sendVerificationEmail(email, code);
  } catch (err) {
    console.error("Failed to send verification email", err);
    fail(res, 502, "We could not send the verification email. Try again.");
    return;
  }
  res.json({ message: "New code sent", email });
});

app.post("/api/auth/forgot-password", async (req, res) => {
  const email = String(req.body?.email ?? "").toLowerCase().trim();
  if (!email) {
    fail(res, 400, "Enter your email address");
    return;
  }
  const user = await one<{ email: string }>("SELECT email FROM users WHERE email = ?", [email]);
  if (user) {
    const code = await createCode(email, "reset");
    try {
      await sendPasswordResetEmail(email, code);
    } catch (err) {
      console.error("Failed to send password reset email", err);
      fail(res, 502, "We could not send the reset email. Try again.");
      return;
    }
  }
  res.json({
    message: "If an account exists for this email, a reset code was sent.",
    email,
    emailed: Boolean(user),
  });
});

app.post("/api/auth/reset-password", async (req, res) => {
  const email = String(req.body?.email ?? "").toLowerCase().trim();
  const code = String(req.body?.code ?? "").trim();
  const password = String(req.body?.password ?? "");
  const confirmPassword = String(req.body?.confirmPassword ?? "");
  if (!email || !code) {
    fail(res, 400, "Email and reset code are required");
    return;
  }
  if (!password || password.length < 6) {
    fail(res, 400, "Password must be at least 6 characters");
    return;
  }
  if (password !== confirmPassword) {
    fail(res, 400, "Passwords do not match");
    return;
  }
  const user = await one<{ id: number }>("SELECT id FROM users WHERE email = ?", [email]);
  if (!user) {
    fail(res, 400, "That code is wrong or expired");
    return;
  }
  if (!(await consumeCode(email, code, "reset"))) {
    fail(res, 400, "That code is wrong or expired");
    return;
  }
  await run("UPDATE users SET passwordHash = ? WHERE email = ?", [bcrypt.hashSync(password, 10), email]);
  res.json({ ok: true, message: "Password updated. You can log in now." });
});

app.post("/api/auth/login", async (req, res) => {
  const email = String(req.body?.email ?? "").toLowerCase().trim();
  const password = String(req.body?.password ?? "");
  const user = await one<AuthUser & { passwordHash: string }>(
    "SELECT * FROM users WHERE email = ?",
    [email],
  );
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    fail(res, 400, "Wrong email or password");
    return;
  }
  if (!user.emailVerified) {
    const purpose = user.role === "vendor" ? "partner" : "register";
    const code = await createCode(user.email, purpose);
    try {
      await sendVerificationEmail(user.email, code);
    } catch (err) {
      console.error("Failed to send verification email", err);
    }
    res.status(403).json({
      error: "Please verify your email first",
      needsVerification: true,
      email: user.email,
    });
    return;
  }
  if (user.role === "vendor") {
    const vendor = await vendorRow(user.id);
    if (!vendor) {
      fail(res, 403, "Vendor account is incomplete");
      return;
    }
    if (vendor.status === "PENDING_EMAIL") {
      res.status(403).json({
        error: "Please verify your email first",
        needsVerification: true,
        email: user.email,
      });
      return;
    }
    if (vendor.status === "PENDING_APPROVAL") {
      res.status(403).json({
        error: "Wait for admin approval. We will review your National ID and RDB certificate.",
        status: vendor.status,
      });
      return;
    }
    if (vendor.status === "REJECTED") {
      res.status(403).json({
        error: vendor.rejectionReason || "Your application was rejected",
        status: "REJECTED",
        rejectionReason: vendor.rejectionReason,
      });
      return;
    }
    if (vendor.suspended) {
      fail(res, 403, "Your shop is suspended. Contact support.");
      return;
    }
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
  const vendor = req.user!.role === "vendor" ? await vendorRow(req.user!.id) : null;
  res.json({ user: publicUser(req.user!), vendor });
});

app.put("/api/auth/profile", requireAuth, async (req, res) => {
  const firstName = String(req.body?.firstName ?? "").trim();
  const lastName = String(req.body?.lastName ?? "").trim();
  const phone = String(req.body?.phone ?? "").trim();
  if (!firstName || !lastName) {
    fail(res, 400, "First and last name are required");
    return;
  }
  if (!phone) {
    fail(res, 400, "Phone number is required");
    return;
  }
  await run("UPDATE users SET firstName = ?, lastName = ?, phone = ? WHERE id = ?", [
    firstName,
    lastName,
    phone,
    req.user!.id,
  ]);
  const user = await one<AuthUser>("SELECT * FROM users WHERE id = ?", [req.user!.id]);
  res.json({ user: publicUser(user!) });
});

app.post("/api/auth/password", requireAuth, async (req, res) => {
  const currentPassword = String(req.body?.currentPassword ?? "");
  const newPassword = String(req.body?.newPassword ?? "");
  if (newPassword.length < 6) {
    fail(res, 400, "New password must be at least 6 characters");
    return;
  }
  const row = await one<{ passwordHash: string }>("SELECT passwordHash FROM users WHERE id = ?", [
    req.user!.id,
  ]);
  if (!row || !bcrypt.compareSync(currentPassword, row.passwordHash)) {
    fail(res, 400, "Current password is incorrect");
    return;
  }
  await run("UPDATE users SET passwordHash = ? WHERE id = ?", [
    bcrypt.hashSync(newPassword, 10),
    req.user!.id,
  ]);
  res.json({ ok: true, message: "Password updated" });
});

app.post("/api/auth/avatar", requireAuth, upload.single("file"), async (req, res) => {
  if (!req.file) {
    fail(res, 400, "Upload a profile photo (JPEG, PNG, WebP, or GIF)");
    return;
  }
  if (!/^image\//i.test(req.file.mimetype)) {
    fail(res, 400, "Profile photo must be an image");
    return;
  }
  const url = fileUrl(req.file.filename);
  await run("UPDATE users SET avatarUrl = ? WHERE id = ?", [url, req.user!.id]);
  const user = await one<AuthUser>("SELECT * FROM users WHERE id = ?", [req.user!.id]);
  res.json({ user: publicUser(user!), url });
});

app.delete("/api/auth/avatar", requireAuth, async (req, res) => {
  await run("UPDATE users SET avatarUrl = NULL WHERE id = ?", [req.user!.id]);
  const user = await one<AuthUser>("SELECT * FROM users WHERE id = ?", [req.user!.id]);
  res.json({ user: publicUser(user!) });
});

app.post(
  "/api/partners/apply",
  upload.fields([
    { name: "nationalId", maxCount: 1 },
    { name: "rdbCertificate", maxCount: 1 },
  ]),
  async (req, res) => {
    const b = req.body ?? {};
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    if (
      !b.firstName ||
      !b.lastName ||
      !b.email ||
      !b.password ||
      !b.businessName ||
      !b.businessType
    ) {
      fail(res, 400, "Fill in all required fields");
      return;
    }
    if (b.password !== b.confirmPassword) {
      fail(res, 400, "Passwords do not match");
      return;
    }
    if (b.acceptTerms !== "true" && b.acceptTerms !== true) {
      fail(res, 400, "Please accept the terms");
      return;
    }
    const idFile = files?.nationalId?.[0];
    const rdbFile = files?.rdbCertificate?.[0];
    if (!idFile || !rdbFile) {
      fail(res, 400, "National ID and RDB certificate are required");
      return;
    }
    const email = String(b.email).toLowerCase().trim();
    if (await one("SELECT id FROM users WHERE email = ?", [email])) {
      fail(res, 400, "That email is already registered");
      return;
    }
    const user = await run(
      `INSERT INTO users(role, firstName, lastName, email, phone, passwordHash, emailVerified, createdAt)
       VALUES('vendor', ?, ?, ?, ?, ?, 0, ?)`,
      [b.firstName, b.lastName, email, String(b.phone || "To be set"), bcrypt.hashSync(b.password, 10), now()],
    );
    await run(
      `INSERT INTO vendors(userId, businessName, businessAddress, businessType, nationalIdUrl, rdbCertificateUrl, status)
       VALUES(?, ?, ?, ?, ?, ?, 'PENDING_EMAIL')`,
      [
        Number(user.lastInsertRowid),
        b.businessName,
        String(b.businessAddress || "Set in vendor shop"),
        b.businessType,
        fileUrl(idFile.filename),
        fileUrl(rdbFile.filename),
      ],
    );
    const code = await createCode(email, "partner");
    await run(
      `INSERT INTO mailbox_messages(folder, fromEmail, fromName, toUserId, toEmail, subject, body, isRead, createdAt)
       VALUES('inbox', ?, ?, NULL, ?, ?, ?, 0, ?)`,
      [
        email,
        `${b.firstName} ${b.lastName}`,
        await setting("email", businessNotifyEmail()),
        `New partner application · ${b.businessName}`,
        `${b.businessName} (${b.businessType}) applied to join Kigali Taste.\nContact: ${email}${b.phone ? ` · ${b.phone}` : ""}`,
        now(),
      ],
    );
    void notifyBusinessInbox({
      subject: `New partner application · ${b.businessName}`,
      body: `${b.firstName} ${b.lastName} applied with ${b.businessName} (${b.businessType}).\nEmail: ${email}${b.phone ? `\nPhone: ${b.phone}` : ""}\n\nReview in Admin → Vendors.`,
      fromName: String(b.businessName),
      fromEmail: email,
    }).catch((err) => console.error("Partner notify email failed", err));
    let emailed = true;
    try {
      await sendVerificationEmail(email, code);
    } catch (err) {
      console.error("Failed to send verification email", err);
      emailed = false;
    }
    res.json({
      email,
      emailed,
      message: emailed
        ? "We sent a 6-digit code to your email. Enter it to continue."
        : "Application saved. We could not send email — tap Resend code again.",
    });
  },
);

app.post(
  "/api/partners/reupload",
  requireAuth,
  upload.fields([
    { name: "nationalId", maxCount: 1 },
    { name: "rdbCertificate", maxCount: 1 },
  ]),
  async (req, res) => {
    const vendor = await vendorRow(req.user!.id);
    if (!vendor || vendor.status !== "REJECTED") {
      fail(res, 400, "You can only re-upload after a rejection");
      return;
    }
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const idFile = files?.nationalId?.[0];
    const rdbFile = files?.rdbCertificate?.[0];
    if (!idFile || !rdbFile) {
      fail(res, 400, "Upload both documents again");
      return;
    }
    await run(
      `UPDATE vendors SET nationalIdUrl = ?, rdbCertificateUrl = ?, status = 'PENDING_APPROVAL', rejectionReason = NULL
       WHERE id = ?`,
      [fileUrl(idFile.filename), fileUrl(rdbFile.filename), vendor.id],
    );
    res.json({ ok: true, status: "PENDING_APPROVAL" });
  },
);

app.get("/api/restaurants", async (_req, res) => {
  const type = String((_req.query.type as string) || "");
  const q = String((_req.query.q as string) || "").toLowerCase();
  const rows = await many<{
    id: number;
    name: string;
    slug: string;
    logoUrl: string | null;
    coverUrl: string | null;
    description: string | null;
    type: string;
    address: string;
    isOpen: number;
    openingHours: string | null;
  }>(
    `SELECT r.id, r.name, r.slug, r.logoUrl, r.coverUrl, r.description, r.\`type\`, r.address, r.isOpen, r.openingHours
     FROM restaurants r
     JOIN vendors v ON v.id = r.vendorId
     WHERE r.isLive = 1 AND v.status = 'APPROVED' AND v.suspended = 0
     ORDER BY r.name`,
  );
  res.json(
    rows.filter((r) => {
      if (type && r.type !== type) return false;
      if (q && !`${r.name} ${r.type} ${r.address}`.toLowerCase().includes(q)) return false;
      return true;
    }),
  );
});

app.get("/api/restaurants/:slug", async (req, res) => {
  const restaurant = await one<Record<string, unknown>>(
    `SELECT r.* FROM restaurants r
     JOIN vendors v ON v.id = r.vendorId
     WHERE r.slug = ? AND r.isLive = 1 AND v.status = 'APPROVED' AND v.suspended = 0`,
    [req.params.slug],
  );
  if (!restaurant) {
    fail(res, 404, "Restaurant not found");
    return;
  }
  const categories = await many<{ id: number; name: string; sort: number }>(
    "SELECT * FROM categories WHERE restaurantId = ? ORDER BY sort, id",
    [restaurant.id as number],
  );
  const items = await many<MenuRow>(
    `SELECT m.*, c.name AS categoryName FROM menu_items m
     JOIN categories c ON c.id = m.categoryId
     WHERE m.restaurantId = ? ORDER BY c.sort, m.id`,
    [restaurant.id as number],
  );
  res.json({
    ...restaurant,
    categories,
    items: items.map(asCustomerItem),
  });
});

app.get("/api/restaurants/:slug/reviews", async (req, res) => {
  const restaurant = await one<{ id: number }>(
    `SELECT r.id FROM restaurants r
     JOIN vendors v ON v.id = r.vendorId
     WHERE r.slug = ? AND r.isLive = 1 AND v.status = 'APPROVED' AND v.suspended = 0`,
    [req.params.slug],
  );
  if (!restaurant) {
    fail(res, 404, "Restaurant not found");
    return;
  }
  const rows = await many<{
    rating: number;
    reviewComment: string | null;
    reviewedAt: string | null;
    customerName: string;
  }>(
    `SELECT rating, reviewComment, reviewedAt, customerName
     FROM orders
     WHERE restaurantId = ? AND rating IS NOT NULL AND reviewVisible = 1
     ORDER BY COALESCE(reviewedAt, createdAt) DESC
     LIMIT 24`,
    [restaurant.id],
  );
  res.json(rows);
});

app.get("/api/catalog", async (_req, res) => {
  const restaurants = await many<{
    id: number;
    name: string;
    slug: string;
    logoUrl: string | null;
    coverUrl: string | null;
    description: string | null;
    type: string;
    address: string;
    isOpen: number;
    openingHours: string | null;
  }>(
    `SELECT r.id, r.name, r.slug, r.logoUrl, r.coverUrl, r.description, r.\`type\`, r.address, r.isOpen, r.openingHours
     FROM restaurants r
     JOIN vendors v ON v.id = r.vendorId
     WHERE r.isLive = 1 AND v.status = 'APPROVED' AND v.suspended = 0
     ORDER BY r.name`,
  );
  const rows = await many<
    MenuRow & {
      restaurantName: string;
      restaurantSlug: string;
      restaurantType: string;
    }
  >(
    `SELECT m.*, c.name AS categoryName, r.name AS restaurantName, r.slug AS restaurantSlug,
            r.\`type\` AS restaurantType
     FROM menu_items m
     JOIN restaurants r ON r.id = m.restaurantId
     JOIN vendors v ON v.id = r.vendorId
     JOIN categories c ON c.id = m.categoryId
     WHERE r.isLive = 1 AND v.status = 'APPROVED' AND v.suspended = 0
     ORDER BY c.sort, m.id`,
  );
  res.json({
    restaurants,
    items: rows.map((item) => ({
      ...asCustomerItem(item),
      restaurantId: item.restaurantId,
      restaurantName: item.restaurantName,
      restaurantSlug: item.restaurantSlug,
      restaurantType: item.restaurantType,
    })),
  });
});

app.post("/api/contact", async (req, res) => {
  const { name, email, subject, body } = req.body ?? {};
  if (!name || !email || !body) {
    fail(res, 400, "Name, email and message are required");
    return;
  }
  await run(
    `INSERT INTO mailbox_messages(folder, fromEmail, fromName, toUserId, toEmail, subject, body, isRead, createdAt)
     VALUES('inbox', ?, ?, NULL, ?, ?, ?, 0, ?)`,
    [
      String(email),
      String(name),
      await setting("email", businessNotifyEmail()),
      String(subject || "Contact form"),
      String(body),
      now(),
    ],
  );
  void notifyBusinessInbox({
    subject: String(subject || "Contact form message"),
    body: String(body),
    fromName: String(name),
    fromEmail: String(email),
  }).catch((err) => console.error("Contact notify email failed", err));
  res.json({ ok: true, message: "Message sent. We will reply soon." });
});

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

app.post("/api/subscribe", async (req, res) => {
  const email = String(req.body?.email || "")
    .trim()
    .toLowerCase();
  if (!email || !isValidEmail(email)) {
    fail(res, 400, "Enter a valid email address");
    return;
  }

  const existing = await one<{ id: number }>(
    "SELECT id FROM newsletter_subscribers WHERE email = ?",
    [email],
  );
  if (existing) {
    res.json({
      ok: true,
      alreadySubscribed: true,
      message: "You are already subscribed — we will email you when there is news.",
    });
    return;
  }

  await run(
    "INSERT INTO newsletter_subscribers(email, subscribedAt, source) VALUES(?, ?, ?)",
    [email, now(), String(req.body?.source || "homepage")],
  );

  const adminEmail = await setting("email", businessNotifyEmail());
  await run(
    `INSERT INTO mailbox_messages(folder, fromEmail, fromName, toUserId, toEmail, subject, body, isRead, createdAt)
     VALUES('inbox', ?, ?, NULL, ?, ?, ?, 0, ?)`,
    [
      email,
      "Newsletter signup",
      adminEmail,
      "New newsletter subscriber",
      `${email} subscribed to Kigali Taste updates from the homepage.`,
      now(),
    ],
  );
  void notifyBusinessInbox({
    subject: "New newsletter subscriber",
    body: `${email} subscribed from the homepage.`,
    fromName: "Newsletter",
    fromEmail: email,
  }).catch((err) => console.error("Newsletter notify email failed", err));

  res.json({
    ok: true,
    message: "You are subscribed! We will email you about new kitchens and offers in Kigali.",
  });
});

app.post("/api/checkout/preview", requireAuth, async (req, res) => {
  const { restaurantId, items, fulfillment, deliveryAddress, promoCode } = req.body ?? {};
  if (!restaurantId || !Array.isArray(items) || items.length === 0) {
    fail(res, 400, "Your cart is empty");
    return;
  }
  try {
    const preview = await computeCheckoutPreview({
      userId: req.user!.id,
      restaurantId: Number(restaurantId),
      items,
      fulfillment,
      deliveryAddress,
      deliveryLat: req.body?.deliveryLat ?? req.body?.lat,
      deliveryLng: req.body?.deliveryLng ?? req.body?.lng,
      deliveryZoneId: req.body?.deliveryZoneId ?? req.body?.zoneId,
      promoCode,
    });
    res.json(preview);
  } catch (err) {
    fail(res, 400, (err as Error).message || "Could not preview checkout");
  }
});

app.post("/api/orders", requireAuth, async (req, res) => {
  const { restaurantId, items, deliveryAddress, customerPhone, notes, paymentMethod } =
    req.body ?? {};
  if (!restaurantId || !Array.isArray(items) || items.length === 0) {
    fail(res, 400, "Your cart is empty");
    return;
  }
  if (!customerPhone) {
    fail(res, 400, "Add a phone number");
    return;
  }
  const fulfillment = String(req.body?.fulfillment || "DELIVERY").toUpperCase() === "PICKUP" ? "PICKUP" : "DELIVERY";
  if (fulfillment === "DELIVERY" && !deliveryAddress) {
    fail(res, 400, "Add a delivery address");
    return;
  }
  const restaurant = await one<{ id: number; isLive: number; name: string; address: string }>(
    `SELECT r.id, r.isLive, r.name, r.address FROM restaurants r
     JOIN vendors v ON v.id = r.vendorId
     WHERE r.id = ? AND r.isLive = 1 AND v.status = 'APPROVED' AND v.suspended = 0`,
    [restaurantId],
  );
  if (!restaurant) {
    fail(res, 400, "This restaurant is not taking orders");
    return;
  }
  const methodRaw = String(paymentMethod || "MOMO").toUpperCase();
  if (methodRaw === "COD" || methodRaw === "CASH") {
    fail(res, 400, "Cash on delivery is not available. Pay with MoMo, Airtel Money, or card.");
    return;
  }
  const method =
    methodRaw === "CARD" || methodRaw === "CC"
      ? "CARD"
      : methodRaw === "AIRTEL"
        ? "AIRTEL"
        : "MOMO";
  if ((method === "MOMO" || method === "AIRTEL" || method === "CARD") && !paymentsConfigured()) {
    fail(res, 503, "Mobile Money and card payments are not configured yet. Add XENTRIPAY_API_KEY.");
    return;
  }
  const lines: {
    menuItemId: number;
    name: string;
    base: number;
    markup: number;
    qty: number;
    isFree: boolean;
    promoTriggerMenuItemId: number | null;
  }[] = [];
  let totals;
  try {
    totals = await resolveOrderTotals({
      userId: req.user!.id,
      restaurantId: Number(restaurantId),
      items: (items as { menuItemId: number; qty: number; isFree?: boolean; promoTriggerMenuItemId?: number }[]).map(
        (l) => ({
          menuItemId: Number(l.menuItemId),
          qty: Math.max(1, Number(l.qty) || 1),
          isFree: Boolean(l.isFree),
          promoTriggerMenuItemId: l.promoTriggerMenuItemId ? Number(l.promoTriggerMenuItemId) : null,
        }),
      ),
      fulfillment,
      deliveryAddress,
      deliveryLat: req.body?.deliveryLat ?? req.body?.lat,
      deliveryLng: req.body?.deliveryLng ?? req.body?.lng,
      deliveryZoneId: req.body?.deliveryZoneId ?? req.body?.zoneId,
      promoCode: req.body?.promoCode,
    });
    lines.push(...totals.lines);
  } catch (err) {
    fail(res, 400, (err as Error).message || "Could not apply promo");
    return;
  }
  const deliveryQuote =
    fulfillment === "PICKUP"
      ? null
      : await resolveDeliveryQuote(
          String(deliveryAddress),
          req.body?.deliveryLat ?? req.body?.lat,
          req.body?.deliveryLng ?? req.body?.lng,
          req.body?.deliveryZoneId ?? req.body?.zoneId,
        );
  const deliveryFee = totals.deliveryFee;
  const vendorAmount = totals.vendorAmount;
  const platformAmount = totals.platformAmount;
  const discount = totals.discount;
  const promo = totals.promoCode;
  const totalDue = totals.total;
  if ((method === "MOMO" || method === "AIRTEL" || method === "CARD") && totalDue < 100) {
    fail(res, 400, "XentriPay collections need at least 100 FRw");
    return;
  }
  const paymentStatus = "PENDING";
  const customerName = `${req.user!.firstName} ${req.user!.lastName}`;
  const orderNumber = await nextOrderNumber();
  const addressText =
    fulfillment === "PICKUP"
      ? `Pickup · ${restaurant.name}${restaurant.address ? ` · ${restaurant.address}` : ""}`
      : String(deliveryAddress);
  const created = await run(
    `INSERT INTO orders(orderNumber, customerId, restaurantId, status, paymentMethod, paymentStatus,
      deliveryFee, vendorAmount, platformAmount, deliveryAddress, customerPhone, customerName, notes, fulfillment,
      deliveryZoneId, deliveryZoneName, deliveryLat, deliveryLng, promoCode, discountAmount, createdAt)
     VALUES(?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      orderNumber,
      req.user!.id,
      restaurantId,
      method,
      paymentStatus,
      deliveryFee,
      vendorAmount,
      platformAmount,
      addressText,
      customerPhone,
      customerName,
      notes || "",
      fulfillment,
      deliveryQuote?.zoneId ?? null,
      deliveryQuote?.zoneName ?? null,
      deliveryQuote?.lat ?? null,
      deliveryQuote?.lng ?? null,
      promo,
      discount,
      now(),
    ],
  );
  const orderId = Number(created.lastInsertRowid);
  if (totals.promoId) await incrementPromoUsage(totals.promoId);
  for (const line of lines) {
    await run(
      `INSERT INTO order_items(orderId, menuItemId, nameSnapshot, basePriceSnapshot, markupSnapshot, qty, isFree, promoTriggerMenuItemId)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        line.menuItemId,
        line.name,
        line.base,
        line.markup,
        line.qty,
        line.isFree ? 1 : 0,
        line.promoTriggerMenuItemId,
      ],
    );
  }
  let payment: Awaited<ReturnType<typeof startCustomerPayment>> | { method: string; status: string; message: string };
  try {
    payment = await startCustomerPayment({
      orderId,
      orderNumber,
      amount: totalDue,
      method,
      user: req.user!,
      phone: String(req.body?.paymentPhone || customerPhone),
    });
  } catch (err) {
    const message = (err as Error).message || "Payment could not be started";
    console.error("Payment start failed", message);
    await run("UPDATE orders SET paymentStatus = 'FAILED' WHERE id = ?", [orderId]);
    payment = { method, status: "FAILED", message };
  }
  const order = await one("SELECT * FROM orders WHERE id = ?", [orderId]);
  res.json({
    order,
    items: lines.map((l) => ({
      name: l.name,
      qty: l.qty,
      price: customerPrice(l.base, l.markup),
    })),
    total: totalDue,
    discount,
    promoCode: promo || null,
    payment,
  });
  notifyOrderPlacedSafe(orderId);
  if (payment.status === "PAID") notifyOrderPaidSafe(orderId);
});

app.get("/api/orders", requireAuth, async (req, res) => {
  const orders = await many<Record<string, unknown>>(
    `SELECT o.*, r.name AS restaurantName, r.logoUrl
     FROM orders o JOIN restaurants r ON r.id = o.restaurantId
     WHERE o.customerId = ? ORDER BY o.id DESC`,
    [req.user!.id],
  );
  const withItems = await Promise.all(
    orders.map(async (order) => ({
      ...order,
      items: await many(
        "SELECT nameSnapshot AS name, qty, (basePriceSnapshot + markupSnapshot) AS price FROM order_items WHERE orderId = ?",
        [order.id as number],
      ),
      total: (order.vendorAmount as number) + (order.platformAmount as number),
    })),
  );
  res.json(withItems);
});

app.get("/api/orders/:id/payment", requireAuth, async (req, res) => {
  const order = await one<{
    id: number;
    customerId: number;
    orderNumber: string;
    paymentMethod: string;
    paymentStatus: string;
    paymentRef: string | null;
    checkoutSessionId: string | null;
    paymentUrl: string | null;
    vendorAmount: number;
    platformAmount: number;
  }>("SELECT * FROM orders WHERE id = ?", [req.params.id]);
  if (!order || order.customerId !== req.user!.id) {
    fail(res, 404, "Order not found");
    return;
  }
  const paymentStatus = await refreshOrderPayment(order);
  res.json({
    id: order.id,
    orderNumber: order.orderNumber,
    paymentMethod: order.paymentMethod,
    paymentStatus,
    paymentUrl: order.paymentUrl,
    total: order.vendorAmount + order.platformAmount,
    message:
      paymentStatus === "PAID"
        ? "Payment received."
        : paymentStatus === "FAILED"
          ? "Payment failed. You can try again."
          : order.paymentMethod === "MOMO"
            ? "Approve the prompt on your phone. Dial *182*7*1# if you do not see it."
            : order.paymentMethod === "AIRTEL"
              ? "Approve the Airtel Money prompt on your phone."
            : order.paymentMethod === "CARD"
              ? "Finish card payment on the secure page."
              : "Pay the rider in cash on delivery.",
  });
});

app.post("/api/orders/:id/pay", requireAuth, async (req, res) => {
  const order = await one<{
    id: number;
    customerId: number;
    orderNumber: string;
    paymentMethod: string;
    paymentStatus: string;
    customerPhone: string;
    vendorAmount: number;
    platformAmount: number;
    status: string;
  }>("SELECT * FROM orders WHERE id = ?", [req.params.id]);
  if (!order || order.customerId !== req.user!.id) {
    fail(res, 404, "Order not found");
    return;
  }
  if (order.status === "CANCELLED") {
    fail(res, 400, "This order was cancelled");
    return;
  }
  if (order.paymentStatus === "PAID") {
    res.json({ ok: true, paymentStatus: "PAID", message: "Already paid" });
    return;
  }
  if (order.paymentMethod !== "MOMO" && order.paymentMethod !== "AIRTEL" && order.paymentMethod !== "CARD") {
    fail(res, 400, "This order is cash on delivery");
    return;
  }
  try {
    const payment = await startCustomerPayment({
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: order.vendorAmount + order.platformAmount,
      method: order.paymentMethod as "MOMO" | "AIRTEL" | "CARD",
      user: req.user!,
      phone: String(req.body?.phone || order.customerPhone),
    });
    await run("UPDATE orders SET paymentStatus = 'PENDING' WHERE id = ?", [order.id]);
    res.json({ ok: true, paymentStatus: "PENDING", payment });
  } catch (err) {
    const message = (err as Error).message || "Payment could not be started";
    const status = /URL|PUBLIC_APP|PAYMENT_PUBLIC|configured|valid|at least 100/i.test(message) ? 400 : 502;
    fail(res, status, message);
  }
});

app.post("/api/orders/:id/cancel", requireAuth, async (req, res) => {
  const order = await one<{ id: number; customerId: number; status: string }>(
    "SELECT * FROM orders WHERE id = ?",
    [req.params.id],
  );
  if (!order || order.customerId !== req.user!.id) {
    fail(res, 404, "Order not found");
    return;
  }
  if (order.status !== "PENDING") {
    fail(res, 400, "You can only cancel while the order is pending");
    return;
  }
  const paid = await one<{ paymentStatus: string; paymentMethod: string }>(
    "SELECT paymentStatus, paymentMethod FROM orders WHERE id = ?",
    [order.id],
  );
  if (paid?.paymentStatus === "PAID" && paid.paymentMethod !== "COD") {
    fail(res, 400, "This order is already paid. Contact Kigali Taste to cancel.");
    return;
  }
  await run("UPDATE orders SET status = 'CANCELLED' WHERE id = ?", [order.id]);
  notifyOrderStatusSafe(order.id, "CANCELLED");
  res.json({ ok: true });
});

app.post("/api/orders/:id/review", requireAuth, async (req, res) => {
  const rating = Number(req.body?.rating);
  if (rating < 1 || rating > 5) {
    fail(res, 400, "Pick 1 to 5 stars");
    return;
  }
  const comment = String(req.body?.comment || "").trim().slice(0, 2000);
  const order = await one<{ id: number; customerId: number; status: string }>(
    "SELECT * FROM orders WHERE id = ?",
    [req.params.id],
  );
  if (!order || order.customerId !== req.user!.id || order.status !== "DELIVERED") {
    fail(res, 400, "You can review after delivery");
    return;
  }
  await run("UPDATE orders SET rating = ?, reviewComment = ?, reviewedAt = ?, reviewVisible = 1 WHERE id = ?", [
    rating,
    comment || null,
    now(),
    order.id,
  ]);
  res.json({ ok: true });
});

app.post("/api/support", requireAuth, async (req, res) => {
  const { subject, body } = req.body ?? {};
  if (!body) {
    fail(res, 400, "Write a message");
    return;
  }
  await run(
    `INSERT INTO mailbox_messages(folder, fromEmail, fromName, toUserId, toEmail, subject, body, isRead, createdAt)
     VALUES('inbox', ?, ?, NULL, ?, ?, ?, 0, ?)`,
    [
      req.user!.email,
      `${req.user!.firstName} ${req.user!.lastName}`,
      await setting("email", businessNotifyEmail()),
      String(subject || "Support ticket"),
      String(body),
      now(),
    ],
  );
  void notifyBusinessInbox({
    subject: String(subject || "Support message"),
    body: String(body),
    fromName: `${req.user!.firstName} ${req.user!.lastName}`,
    fromEmail: req.user!.email,
  }).catch((err) => console.error("Support notify email failed", err));
  res.json({ ok: true });
});

async function vendorShop(userId: number) {
  const vendor = await vendorRow(userId);
  if (!vendor) return null;
  const restaurant = await one<Record<string, unknown>>(
    "SELECT * FROM restaurants WHERE vendorId = ?",
    [vendor.id],
  );
  return { vendor, restaurant };
}

app.get("/api/vendor/dashboard", requireAuth, requireRole("vendor"), async (req, res) => {
  const ctx = await vendorShop(req.user!.id);
  if (!ctx?.restaurant) {
    fail(res, 400, "Shop is not ready yet");
    return;
  }
  const rid = ctx.restaurant.id as number;
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = await count(
    "SELECT COUNT(*) AS n FROM orders WHERE restaurantId = ? AND createdAt LIKE ?",
    [rid, `${today}%`],
  );
  const pendingOrders = await count(
    "SELECT COUNT(*) AS n FROM orders WHERE restaurantId = ? AND status IN ('PENDING','ACCEPTED','PREPARING')",
    [rid],
  );
  await syncDeliveredWalletCredits({ vendorId: ctx.vendor.id });
  const fresh = await walletStats("vendor", ctx.vendor.id);
  const pendingEarnings = await pendingVendorEarnings(ctx.vendor.id);
  res.json({
    vendor: ctx.vendor,
    restaurant: ctx.restaurant,
    todayCount,
    pending: pendingOrders,
    wallet: fresh.available,
    earned: fresh.collected,
    paidToYou: fresh.available,
    paidOut: fresh.paidOut,
    held: fresh.held,
    pendingEarnings,
  });
});

app.get("/api/vendor/shop", requireAuth, requireRole("vendor"), async (req, res) => {
  const ctx = await vendorShop(req.user!.id);
  if (!ctx) {
    fail(res, 404, "Vendor not found");
    return;
  }
  res.json(ctx);
});

app.put("/api/vendor/shop", requireAuth, requireRole("vendor"), async (req, res) => {
  const ctx = await vendorShop(req.user!.id);
  if (!ctx?.restaurant) {
    fail(res, 400, "Shop is not ready yet");
    return;
  }
  const b = req.body ?? {};
  let isLive = ctx.restaurant.isLive;
  if (typeof b.isLive === "boolean") {
    if (b.isLive) {
      const items = await count(
        "SELECT COUNT(*) AS n FROM menu_items WHERE restaurantId = ?",
        [ctx.restaurant.id as number],
      );
      if (items < 1) {
        fail(res, 400, "Add at least one menu item before going live");
        return;
      }
      const phone = String(b.phone ?? ctx.restaurant.phone ?? "").trim();
      const address = String(b.address ?? ctx.restaurant.address ?? "").trim();
      if (!phone || !address || phone === "To be set" || address === "Set in vendor shop") {
        fail(res, 400, "Add your shop phone and address before going live");
        return;
      }
      if (ctx.vendor.suspended) {
        fail(res, 400, "Your shop is suspended");
        return;
      }
    }
    isLive = b.isLive ? 1 : 0;
  }
  await run(
    `UPDATE restaurants SET name = ?, phone = ?, address = ?, description = ?, openingHours = ?, isOpen = ?, isLive = ?, \`type\` = ?, logoUrl = ?, coverUrl = ?
     WHERE id = ?`,
    [
      b.name ?? ctx.restaurant.name,
      b.phone ?? ctx.restaurant.phone,
      b.address ?? ctx.restaurant.address,
      b.description ?? ctx.restaurant.description,
      b.openingHours ?? ctx.restaurant.openingHours,
      b.isOpen === false ? 0 : 1,
      isLive,
      b.type ?? ctx.restaurant.type,
      b.logoUrl !== undefined ? remoteImageUrl(b.logoUrl) || ctx.restaurant.logoUrl : ctx.restaurant.logoUrl,
      b.coverUrl !== undefined ? remoteImageUrl(b.coverUrl) || ctx.restaurant.coverUrl : ctx.restaurant.coverUrl,
      ctx.restaurant.id as number,
    ],
  );
  res.json({ ok: true, restaurant: await one("SELECT * FROM restaurants WHERE id = ?", [ctx.restaurant.id as number]) });
});

app.post(
  "/api/vendor/shop/image",
  requireAuth,
  requireRole("vendor"),
  upload.single("file"),
  async (req, res) => {
    const ctx = await vendorShop(req.user!.id);
    if (!ctx?.restaurant || !req.file) {
      fail(res, 400, "Upload a photo");
      return;
    }
    const field = req.body?.kind === "cover" ? "coverUrl" : "logoUrl";
    await run(`UPDATE restaurants SET ${field} = ? WHERE id = ?`, [
      fileUrl(req.file.filename),
      ctx.restaurant.id as number,
    ]);
    res.json({ url: fileUrl(req.file.filename) });
  },
);

app.get("/api/vendor/menu", requireAuth, requireRole("vendor"), async (req, res) => {
  const ctx = await vendorShop(req.user!.id);
  if (!ctx?.restaurant) {
    fail(res, 400, "Shop is not ready yet");
    return;
  }
  const rid = ctx.restaurant.id as number;
  const categories = await many("SELECT * FROM categories WHERE restaurantId = ? ORDER BY sort, id", [rid]);
  const items = await many<MenuRow>(
    `SELECT m.*, c.name AS categoryName FROM menu_items m
     JOIN categories c ON c.id = m.categoryId WHERE m.restaurantId = ? ORDER BY m.id`,
    [rid],
  );
  res.json({ categories, items: items.map(asVendorItem) });
});

app.post("/api/vendor/categories", requireAuth, requireRole("vendor"), async (req, res) => {
  const ctx = await vendorShop(req.user!.id);
  if (!ctx?.restaurant) {
    fail(res, 400, "Shop is not ready yet");
    return;
  }
  const name = String(req.body?.name || "").trim();
  if (!name) {
    fail(res, 400, "Category name is required");
    return;
  }
  const created = await run(
    "INSERT INTO categories(restaurantId, name, sort) VALUES(?, ?, 0)",
    [ctx.restaurant.id as number, name],
  );
  res.json({ id: Number(created.lastInsertRowid), name });
});

app.post(
  "/api/vendor/menu",
  requireAuth,
  requireRole("vendor"),
  upload.single("image"),
  async (req, res) => {
    const ctx = await vendorShop(req.user!.id);
    if (!ctx?.restaurant) {
      fail(res, 400, "Shop is not ready yet");
      return;
    }
    const { name, description, categoryId, basePrice } = req.body ?? {};
    if (!name || !categoryId || basePrice == null) {
      fail(res, 400, "Name, category and price are required");
      return;
    }
    const cat = await one<{ restaurantId: number }>("SELECT restaurantId FROM categories WHERE id = ?", [
      categoryId,
    ]);
    if (!cat || cat.restaurantId !== ctx.restaurant.id) {
      fail(res, 400, "Pick a category from your shop");
      return;
    }
    const promo = normalizePromoWrite(req.body ?? {});
    const created = await run(
      `INSERT INTO menu_items(restaurantId, categoryId, name, description, imageUrl, basePrice, adminMarkup, isAvailable, promoActive, promoType, promoBuyQty, promoGetQty, promoGetIds)
       VALUES(?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?, ?, ?)`,
      [
        ctx.restaurant.id as number,
        Number(categoryId),
        name,
        description || "",
        req.file ? fileUrl(req.file.filename) : remoteImageUrl(req.body?.imageUrl),
        Math.max(0, money(basePrice)),
        promo.promoActive,
        promo.promoType,
        promo.promoBuyQty,
        promo.promoGetQty,
        promo.promoGetIds,
      ],
    );
    const item = await one<MenuRow>("SELECT * FROM menu_items WHERE id = ?", [
      Number(created.lastInsertRowid),
    ]);
    res.json(asVendorItem(item!));
  },
);

app.put("/api/vendor/menu/:id", requireAuth, requireRole("vendor"), async (req, res) => {
  const ctx = await vendorShop(req.user!.id);
  const item = await one<MenuRow>("SELECT * FROM menu_items WHERE id = ?", [req.params.id]);
  if (!ctx?.restaurant || !item || item.restaurantId !== ctx.restaurant.id) {
    fail(res, 404, "Item not found");
    return;
  }
  const b = req.body ?? {};
  let imageUrl = item.imageUrl;
  if (b.imageUrl !== undefined) {
    const next = remoteImageUrl(b.imageUrl);
    if (String(b.imageUrl).trim() && !next) {
      fail(res, 400, "Use a full image address starting with http:// or https://");
      return;
    }
    imageUrl = next;
  }
  const promo = normalizePromoWrite(b, item as MenuRow);
  await run(
    `UPDATE menu_items SET name = ?, description = ?, categoryId = ?, basePrice = ?, isAvailable = ?, imageUrl = ?,
     promoActive = ?, promoType = ?, promoBuyQty = ?, promoGetQty = ?, promoGetIds = ?
     WHERE id = ?`,
    [
      b.name ?? item.name,
      b.description ?? item.description,
      b.categoryId ?? item.categoryId,
      b.basePrice != null && String(b.basePrice) !== ""
        ? Math.max(0, money(b.basePrice))
        : money(item.basePrice),
      b.isAvailable == null ? item.isAvailable : b.isAvailable ? 1 : 0,
      imageUrl,
      promo.promoActive,
      promo.promoType,
      promo.promoBuyQty,
      promo.promoGetQty,
      promo.promoGetIds,
      item.id,
    ],
  );
  const updated = await one<MenuRow>("SELECT * FROM menu_items WHERE id = ?", [item.id]);
  res.json(asVendorItem(updated!));
});

app.post(
  "/api/vendor/menu/:id/image",
  requireAuth,
  requireRole("vendor"),
  upload.single("image"),
  async (req, res) => {
    const ctx = await vendorShop(req.user!.id);
    const item = await one<MenuRow>("SELECT * FROM menu_items WHERE id = ?", [req.params.id]);
    if (!ctx?.restaurant || !item || item.restaurantId !== ctx.restaurant.id) {
      fail(res, 404, "Item not found");
      return;
    }
    if (!req.file) {
      fail(res, 400, "Upload a photo");
      return;
    }
    await run("UPDATE menu_items SET imageUrl = ? WHERE id = ?", [fileUrl(req.file.filename), item.id]);
    const updated = await one<MenuRow>("SELECT * FROM menu_items WHERE id = ?", [item.id]);
    res.json(asVendorItem(updated!));
  },
);

app.delete("/api/vendor/menu/:id", requireAuth, requireRole("vendor"), async (req, res) => {
  const ctx = await vendorShop(req.user!.id);
  const item = await one<MenuRow>("SELECT * FROM menu_items WHERE id = ?", [req.params.id]);
  if (!ctx?.restaurant || !item || item.restaurantId !== ctx.restaurant.id) {
    fail(res, 404, "Item not found");
    return;
  }
  await run("UPDATE order_items SET menuItemId = NULL WHERE menuItemId = ?", [item.id]);
  await run("DELETE FROM menu_items WHERE id = ?", [item.id]);
  res.json({ ok: true });
});

app.put("/api/vendor/categories/:id", requireAuth, requireRole("vendor"), async (req, res) => {
  const ctx = await vendorShop(req.user!.id);
  const cat = await one<{ id: number; restaurantId: number; name: string }>(
    "SELECT * FROM categories WHERE id = ?",
    [req.params.id],
  );
  if (!ctx?.restaurant || !cat || cat.restaurantId !== ctx.restaurant.id) {
    fail(res, 404, "Menu not found");
    return;
  }
  const name = String(req.body?.name || "").trim();
  if (!name) {
    fail(res, 400, "Category name is required");
    return;
  }
  await run("UPDATE categories SET name = ? WHERE id = ?", [name, cat.id]);
  res.json({ id: cat.id, name });
});

app.delete("/api/vendor/categories/:id", requireAuth, requireRole("vendor"), async (req, res) => {
  const ctx = await vendorShop(req.user!.id);
  const cat = await one<{ id: number; restaurantId: number }>("SELECT * FROM categories WHERE id = ?", [
    req.params.id,
  ]);
  if (!ctx?.restaurant || !cat || cat.restaurantId !== ctx.restaurant.id) {
    fail(res, 404, "Menu not found");
    return;
  }
  const used = await count("SELECT COUNT(*) AS n FROM menu_items WHERE categoryId = ?", [cat.id]);
  if (used > 0) {
    fail(res, 400, "Delete or move dishes in this menu first");
    return;
  }
  await run("DELETE FROM categories WHERE id = ?", [cat.id]);
  res.json({ ok: true });
});

app.get("/api/vendor/orders", requireAuth, requireRole("vendor"), async (req, res) => {
  const ctx = await vendorShop(req.user!.id);
  if (!ctx?.restaurant) {
    fail(res, 400, "Shop is not ready yet");
    return;
  }
  const orders = await many<Record<string, unknown>>(
    `SELECT id, orderNumber, status, customerName, notes, createdAt, vendorAmount, platformAmount, paymentStatus, paymentMethod
     FROM orders WHERE restaurantId = ? ORDER BY id DESC`,
    [ctx.restaurant.id as number],
  );
  res.json(
    await Promise.all(
      orders.map(async (order) => ({
        ...order,
        items: await many(
          "SELECT nameSnapshot AS name, qty FROM order_items WHERE orderId = ?",
          [order.id as number],
        ),
      })),
    ),
  );
});

const VENDOR_FLOW: Record<string, string> = {
  PENDING: "ACCEPTED",
  ACCEPTED: "PREPARING",
  PREPARING: "READY",
};

app.post("/api/vendor/orders/:id/status", requireAuth, requireRole("vendor"), async (req, res) => {
  const ctx = await vendorShop(req.user!.id);
  const order = await one<{
    id: number;
    restaurantId: number;
    status: string;
    paymentStatus: string;
    paymentMethod: string;
  }>(
    "SELECT * FROM orders WHERE id = ?",
    [req.params.id],
  );
  if (!ctx?.restaurant || !order || order.restaurantId !== ctx.restaurant.id) {
    fail(res, 404, "Order not found");
    return;
  }
  if (order.status === "PENDING" && order.paymentMethod !== "COD" && order.paymentStatus !== "PAID") {
    fail(res, 400, "Wait until the customer pays");
    return;
  }
  const wanted = String(req.body?.status || "");
  if (wanted === "DELIVERED" || wanted === "OUT_FOR_DELIVERY") {
    fail(res, 403, "Only Kigali Taste can mark delivery");
    return;
  }
  const next = VENDOR_FLOW[order.status];
  if (!next || wanted !== next) {
    fail(res, 400, `You can only move this order to ${next || "no further vendor status"}`);
    return;
  }
  await run("UPDATE orders SET status = ? WHERE id = ?", [next, order.id]);
  notifyOrderStatusSafe(order.id, next);
  res.json({ ok: true, status: next });
});

app.get("/api/vendor/wallet", requireAuth, requireRole("vendor"), async (req, res) => {
  const vendor = await vendorRow(req.user!.id);
  if (!vendor) {
    fail(res, 404, "Vendor not found");
    return;
  }
  const shop = await one<{ name: string; isLive: number; phone: string | null }>(
    "SELECT name, isLive, phone FROM restaurants WHERE vendorId = ?",
    [vendor.id],
  );
  await syncDeliveredWalletCredits({ vendorId: vendor.id });
  const fresh = await walletStats("vendor", vendor.id);
  const pendingEarnings = await pendingVendorEarnings(vendor.id);
  res.json({
    ...fresh,
    earned: fresh.collected,
    paidToYou: fresh.available,
    pendingEarnings,
    shopName: shop?.name || vendor.businessName,
    live: Boolean(shop?.isLive),
    paymentsReady: paymentsConfigured(),
    phone: shop?.phone || "",
    earnings: await many(
      "SELECT * FROM wallet_transactions WHERE ownerType = 'vendor' AND ownerId = ? ORDER BY id DESC",
      [vendor.id],
    ),
    payouts: await many(
      "SELECT * FROM payout_requests WHERE vendorId = ? ORDER BY id DESC",
      [vendor.id],
    ),
  });
});

app.get("/api/vendor/transactions", requireAuth, requireRole("vendor"), async (req, res) => {
  const vendor = await vendorRow(req.user!.id);
  if (!vendor) {
    fail(res, 404, "Vendor not found");
    return;
  }
  const shop = await one<{ name: string }>("SELECT name FROM restaurants WHERE vendorId = ?", [vendor.id]);
  const shopName = shop?.name || vendor.businessName;
  await syncDeliveredWalletCredits({ vendorId: vendor.id });
  const stats = await walletStats("vendor", vendor.id);
  const pendingEarnings = await pendingVendorEarnings(vendor.id);
  res.json({
    shopName,
    earned: stats.collected,
    paidToYou: stats.available,
    available: stats.available,
    paidOut: stats.paidOut,
    held: stats.held,
    pendingEarnings,
    transactions: await vendorTransactionFeed(vendor.id, shopName),
  });
});

app.post("/api/payouts/lookup", requireAuth, async (req, res) => {
  try {
    const looked = await lookupMomoName(
      String(req.body?.msisdn || ""),
      req.body?.amount,
      String(req.body?.telecomProviderId || ""),
    );
    if (!looked.name) {
      fail(res, 400, "XentriPay did not return a registered name for this number");
      return;
    }
    res.json({
      local: looked.local,
      providerId: looked.providerId,
      providerName: looked.providerName,
      amount: looked.amount,
      name: looked.name,
      match: true,
      lookedUp: true,
      fromProvider: true,
      customerReference: looked.customerReference || "",
      ready: true,
    });
  } catch (err) {
    const message = (err as Error).message || "";
    if (/aborted|timeout/i.test(message)) {
      fail(res, 400, "XentriPay took too long to read this number. Try validate again.");
      return;
    }
    fail(res, 400, message);
  }
});

app.post("/api/vendor/payouts", requireAuth, requireRole("vendor"), async (req, res) => {
  const vendor = await vendorRow(req.user!.id);
  if (!vendor) {
    fail(res, 404, "Vendor not found");
    return;
  }
  if (!req.body?.confirmed) {
    fail(res, 400, "Tick the box to confirm this payout");
    return;
  }
  const expectedName = String(req.body?.expectedName || req.body?.name || "").trim();
  const recipientName = String(req.body?.recipientName || "").trim();
  let ready;
  try {
    ready = preparePayout(
      String(req.body?.msisdn || ""),
      req.body?.amount,
      String(req.body?.telecomProviderId || ""),
    );
  } catch (err) {
    fail(res, 400, (err as Error).message);
    return;
  }
  try {
    requireMatchedPayoutName(ready.local, ready.amount, ready.providerId, recipientName || expectedName);
  } catch (err) {
    fail(res, 400, (err as Error).message);
    return;
  }
  if (!recipientName) {
    fail(res, 400, "Enter the recipient name, then check details before sending");
    return;
  }
  const methodNote = `${ready.providerName} ${ready.local}`;
  const available = (await walletStats("vendor", vendor.id)).available;
  if (ready.amount > available) {
    fail(res, 400, "That is more than your available balance");
    return;
  }
  const created = await run(
    `INSERT INTO payout_requests(vendorId, ownerType, amount, methodNote, status, msisdn, recipientName, telecomProviderId, createdAt)
     VALUES(?, 'vendor', ?, ?, 'REQUESTED', ?, ?, ?, ?)`,
    [vendor.id, ready.amount, methodNote, ready.local, recipientName, ready.providerId, now()],
  );
  const payoutId = Number(created.lastInsertRowid);
  if (paymentsConfigured()) {
    try {
      res.json(await dispatchPayout(payoutId, recipientName));
      return;
    } catch (err) {
      await run("UPDATE payout_requests SET status = 'FAILED', adminNote = ? WHERE id = ?", [
        (err as Error).message,
        payoutId,
      ]);
      fail(res, 502, (err as Error).message || "Payout could not be sent on XentriPay");
      return;
    }
  }
  res.json({
    id: payoutId,
    status: "REQUESTED",
    message: "Payout requested. Admin will send it on XentriPay and confirm the OTP.",
  });
});

app.post("/api/vendor/payouts/:id/status", requireAuth, requireRole("vendor"), async (req, res) => {
  const vendor = await vendorRow(req.user!.id);
  const payout = await one<{ id: number; vendorId: number; customerReference: string | null; status: string }>(
    "SELECT * FROM payout_requests WHERE id = ?",
    [req.params.id],
  );
  if (!vendor || !payout || payout.vendorId !== vendor.id) {
    fail(res, 404, "Payout not found");
    return;
  }
  const result = await refreshPayout(payout);
  res.json({ ok: true, ...result });
});

app.get("/api/admin/dashboard", requireAuth, requireRole("admin"), async (_req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  await syncDeliveredWalletCredits();
  const stats = await walletStats("platform", 0);
  const commission = await platformCommission();
  const pending = await pendingPlatformEarnings();
  const recent = await many<{
    id: number;
    orderNumber: string;
    status: string;
    paymentStatus: string;
    restaurantName: string;
    vendorAmount: number;
    platformAmount: number;
    customerName: string;
    createdAt: string;
  }>(
    `SELECT o.id, o.orderNumber, o.status, o.paymentStatus, o.vendorAmount, o.platformAmount,
            o.customerName, o.createdAt, r.name AS restaurantName
     FROM orders o JOIN restaurants r ON r.id = o.restaurantId
     ORDER BY o.id DESC LIMIT 6`,
  );
  res.json({
    platformWallet: stats.available,
    earned: stats.collected,
    paidOut: stats.paidOut,
    held: stats.held,
    markupEarned: commission.markupEarned,
    deliveryEarned: commission.deliveryEarned,
    pendingEarnings: pending.total,
    pendingMarkup: pending.markup,
    pendingDelivery: pending.delivery,
    todayOrders: await count("SELECT COUNT(*) AS n FROM orders WHERE createdAt LIKE ?", [
      `${today}%`,
    ]),
    totalOrders: await count("SELECT COUNT(*) AS n FROM orders"),
    activeOrders: await count(
      "SELECT COUNT(*) AS n FROM orders WHERE status NOT IN ('DELIVERED', 'CANCELLED')",
    ),
    readyForDelivery: await count("SELECT COUNT(*) AS n FROM orders WHERE status = 'READY'"),
    outForDelivery: await count("SELECT COUNT(*) AS n FROM orders WHERE status = 'OUT_FOR_DELIVERY'"),
    awaitingPayment: await count(
      "SELECT COUNT(*) AS n FROM orders WHERE paymentStatus != 'PAID' AND status != 'CANCELLED'",
    ),
    pendingVendors: await count(
      "SELECT COUNT(*) AS n FROM vendors WHERE status = 'PENDING_APPROVAL'",
    ),
    suspendedVendors: await count("SELECT COUNT(*) AS n FROM vendors WHERE suspended = 1"),
    liveRestaurants: await count("SELECT COUNT(*) AS n FROM restaurants WHERE isLive = 1"),
    totalRestaurants: await count("SELECT COUNT(*) AS n FROM restaurants"),
    totalCustomers: await count("SELECT COUNT(*) AS n FROM users WHERE role = 'customer'"),
    newsletterSubscribers: await count("SELECT COUNT(*) AS n FROM newsletter_subscribers"),
    paymentsReady: paymentsConfigured(),
    recentOrders: recent.map((row) => ({
      ...row,
      total: row.vendorAmount + row.platformAmount,
    })),
  });
});

app.get("/api/admin/vendors", requireAuth, requireRole("admin"), async (req, res) => {
  const status = String(req.query.status || "");
  const rows = await many<Record<string, unknown>>(
    `SELECT v.*, u.firstName, u.lastName, u.email, u.phone,
            r.id AS restaurantId, r.isLive, r.slug
     FROM vendors v JOIN users u ON u.id = v.userId
     LEFT JOIN restaurants r ON r.vendorId = v.id
     ${status ? "WHERE v.status = ?" : ""}
     ORDER BY v.id DESC`,
    status ? [status] : [],
  );
  res.json(rows);
});

app.post("/api/admin/vendors/:id/approve", requireAuth, requireRole("admin"), async (req, res) => {
  const vendor = await one<{
    id: number;
    userId: number;
    businessName: string;
    businessAddress: string;
    businessType: string;
    status: string;
  }>("SELECT * FROM vendors WHERE id = ?", [req.params.id]);
  if (!vendor) {
    fail(res, 404, "Vendor not found");
    return;
  }
  await run(
    "UPDATE vendors SET status = 'APPROVED', rejectionReason = NULL, suspended = 0 WHERE id = ?",
    [vendor.id],
  );
  const existing = await one("SELECT id FROM restaurants WHERE vendorId = ?", [vendor.id]);
  if (!existing) {
    const user = await one<AuthUser>("SELECT * FROM users WHERE id = ?", [vendor.userId]);
    await run(
      `INSERT INTO restaurants(vendorId, name, slug, description, address, phone, \`type\`, isLive, isOpen, openingHours)
       VALUES(?, ?, ?, '', ?, ?, ?, 0, 1, '09:00 – 21:00')`,
      [
        vendor.id,
        vendor.businessName,
        await uniqueSlug(vendor.businessName),
        vendor.businessAddress,
        user?.phone || "",
        vendor.businessType,
      ],
    );
  }
  const user = await one<AuthUser>("SELECT * FROM users WHERE id = ?", [vendor.userId]);
  await run(
    `INSERT INTO mailbox_messages(folder, fromEmail, fromName, toUserId, toEmail, subject, body, isRead, createdAt)
     VALUES('sent', ?, 'Kigali Taste', ?, ?, 'You’re live — log in',
     'Your shop was approved. Log in at /vendor/login and add your menu.', 1, ?)`,
    [
      await setting("email", businessNotifyEmail()),
      vendor.userId,
      user?.email || "",
      now(),
    ],
  );
  res.json({ ok: true });
});

app.post("/api/admin/vendors/:id/reject", requireAuth, requireRole("admin"), async (req, res) => {
  const reason = String(req.body?.reason || "").trim();
  if (!reason) {
    fail(res, 400, "A reject reason is required");
    return;
  }
  await run("UPDATE vendors SET status = 'REJECTED', rejectionReason = ? WHERE id = ?", [
    reason,
    req.params.id,
  ]);
  res.json({ ok: true });
});

app.post("/api/admin/vendors/:id/suspend", requireAuth, requireRole("admin"), async (req, res) => {
  const vendor = await one<{ id: number }>("SELECT id FROM vendors WHERE id = ?", [req.params.id]);
  if (!vendor) {
    fail(res, 404, "Vendor not found");
    return;
  }
  await run("UPDATE vendors SET suspended = 1 WHERE id = ?", [vendor.id]);
  await run("UPDATE restaurants SET isLive = 0 WHERE vendorId = ?", [vendor.id]);
  res.json({ ok: true });
});

app.post("/api/admin/vendors/:id/unsuspend", requireAuth, requireRole("admin"), async (req, res) => {
  const vendor = await one<{ id: number; status: string }>("SELECT id, status FROM vendors WHERE id = ?", [
    req.params.id,
  ]);
  if (!vendor) {
    fail(res, 404, "Vendor not found");
    return;
  }
  if (vendor.status !== "APPROVED") {
    fail(res, 400, "Only approved vendors can be unsuspended");
    return;
  }
  await run("UPDATE vendors SET suspended = 0 WHERE id = ?", [vendor.id]);
  res.json({ ok: true });
});

app.get("/api/admin/customers", requireAuth, requireRole("admin"), async (_req, res) => {
  res.json(
    await many(
      `SELECT u.id, u.firstName, u.lastName, u.email, u.phone, u.createdAt,
              (SELECT COUNT(*) FROM orders o WHERE o.customerId = u.id) AS orderCount
       FROM users u WHERE u.role = 'customer' ORDER BY u.id DESC`,
    ),
  );
});

app.get("/api/admin/restaurants", requireAuth, requireRole("admin"), async (_req, res) => {
  res.json(
    await many(
      `SELECT r.*, v.businessName, v.status AS vendorStatus, v.suspended,
              (SELECT COUNT(*) FROM menu_items m WHERE m.restaurantId = r.id) AS menuCount,
              (SELECT COUNT(*) FROM orders o WHERE o.restaurantId = r.id) AS orderCount
       FROM restaurants r
       JOIN vendors v ON v.id = r.vendorId
       ORDER BY r.name`,
    ),
  );
});

app.post("/api/admin/restaurants/:id/visibility", requireAuth, requireRole("admin"), async (req, res) => {
  const restaurant = await one<{
    id: number;
    isLive: number;
    isOpen: number;
    vendorId: number;
  }>("SELECT id, isLive, isOpen, vendorId FROM restaurants WHERE id = ?", [req.params.id]);
  if (!restaurant) {
    fail(res, 404, "Restaurant not found");
    return;
  }
  const vendor = await one<{ status: string; suspended: number }>(
    "SELECT status, suspended FROM vendors WHERE id = ?",
    [restaurant.vendorId],
  );
  if (!vendor) {
    fail(res, 404, "Vendor not found");
    return;
  }

  let isLive = restaurant.isLive;
  let isOpen = restaurant.isOpen;
  if (typeof req.body?.isLive === "boolean") {
    if (req.body.isLive) {
      if (vendor.status !== "APPROVED") {
        fail(res, 400, "Approve the vendor before putting this kitchen live");
        return;
      }
      if (vendor.suspended) {
        fail(res, 400, "Unsuspend the vendor before putting this kitchen live");
        return;
      }
      const items = await count("SELECT COUNT(*) AS n FROM menu_items WHERE restaurantId = ?", [restaurant.id]);
      if (items < 1) {
        fail(res, 400, "Add at least one menu item before putting this kitchen live");
        return;
      }
    }
    isLive = req.body.isLive ? 1 : 0;
  }
  if (typeof req.body?.isOpen === "boolean") {
    isOpen = req.body.isOpen ? 1 : 0;
  }

  await run("UPDATE restaurants SET isLive = ?, isOpen = ? WHERE id = ?", [isLive, isOpen, restaurant.id]);
  const row = await one(
    `SELECT r.*, v.businessName, v.status AS vendorStatus, v.suspended,
            (SELECT COUNT(*) FROM menu_items m WHERE m.restaurantId = r.id) AS menuCount,
            (SELECT COUNT(*) FROM orders o WHERE o.restaurantId = r.id) AS orderCount
     FROM restaurants r
     JOIN vendors v ON v.id = r.vendorId
     WHERE r.id = ?`,
    [restaurant.id],
  );
  res.json({ ok: true, restaurant: row });
});

app.get("/api/admin/restaurants/:id/menu", requireAuth, requireRole("admin"), async (req, res) => {
  const restaurant = await one("SELECT * FROM restaurants WHERE id = ?", [req.params.id]);
  if (!restaurant) {
    fail(res, 404, "Restaurant not found");
    return;
  }
  const rid = Number(req.params.id);
  const categories = await many("SELECT * FROM categories WHERE restaurantId = ? ORDER BY sort, id", [rid]);
  const items = await many<MenuRow>(
    `SELECT m.*, c.name AS categoryName FROM menu_items m
     JOIN categories c ON c.id = m.categoryId WHERE m.restaurantId = ? ORDER BY m.id`,
    [rid],
  );
  res.json({
    restaurant,
    categories,
    items: items.map(asAdminItem),
  });
});

app.post("/api/admin/restaurants/:id/categories", requireAuth, requireRole("admin"), async (req, res) => {
  const restaurant = await one("SELECT id FROM restaurants WHERE id = ?", [req.params.id]);
  if (!restaurant) {
    fail(res, 404, "Restaurant not found");
    return;
  }
  const name = String(req.body?.name || "").trim();
  if (!name) {
    fail(res, 400, "Category name is required");
    return;
  }
  const created = await run(
    "INSERT INTO categories(restaurantId, name, sort) VALUES(?, ?, 0)",
    [req.params.id, name],
  );
  res.json({ id: Number(created.lastInsertRowid), name });
});

app.put("/api/admin/restaurants/:rid/categories/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const cat = await one<{ id: number; restaurantId: number }>("SELECT * FROM categories WHERE id = ?", [
    req.params.id,
  ]);
  if (!cat || String(cat.restaurantId) !== String(req.params.rid)) {
    fail(res, 404, "Menu not found");
    return;
  }
  const name = String(req.body?.name || "").trim();
  if (!name) {
    fail(res, 400, "Category name is required");
    return;
  }
  await run("UPDATE categories SET name = ? WHERE id = ?", [name, cat.id]);
  res.json({ id: cat.id, name });
});

app.delete("/api/admin/restaurants/:rid/categories/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const cat = await one<{ id: number; restaurantId: number }>("SELECT * FROM categories WHERE id = ?", [
    req.params.id,
  ]);
  if (!cat || String(cat.restaurantId) !== String(req.params.rid)) {
    fail(res, 404, "Menu not found");
    return;
  }
  const used = await count("SELECT COUNT(*) AS n FROM menu_items WHERE categoryId = ?", [cat.id]);
  if (used > 0) {
    fail(res, 400, "Delete or move dishes in this menu first");
    return;
  }
  await run("DELETE FROM categories WHERE id = ?", [cat.id]);
  res.json({ ok: true });
});

app.post(
  "/api/admin/restaurants/:id/menu",
  requireAuth,
  requireRole("admin"),
  upload.single("image"),
  async (req, res) => {
    const restaurant = await one("SELECT id FROM restaurants WHERE id = ?", [req.params.id]);
    if (!restaurant) {
      fail(res, 404, "Restaurant not found");
      return;
    }
    const { name, description, categoryId, basePrice, adminMarkup } = req.body ?? {};
    if (!name || !categoryId || basePrice == null) {
      fail(res, 400, "Name, category and base price are required");
      return;
    }
    const cat = await one<{ restaurantId: number }>("SELECT restaurantId FROM categories WHERE id = ?", [
      categoryId,
    ]);
    if (!cat || cat.restaurantId !== Number(req.params.id)) {
      fail(res, 400, "Pick a category from this restaurant");
      return;
    }
    const promo = normalizePromoWrite(req.body ?? {});
    const created = await run(
      `INSERT INTO menu_items(restaurantId, categoryId, name, description, imageUrl, basePrice, adminMarkup, isAvailable, promoActive, promoType, promoBuyQty, promoGetQty, promoGetIds)
       VALUES(?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`,
      [
        req.params.id,
        Number(categoryId),
        name,
        description || "",
        req.file ? fileUrl(req.file.filename) : remoteImageUrl(req.body?.imageUrl),
        Math.max(0, money(basePrice)),
        Math.max(0, money(adminMarkup ?? 0)),
        promo.promoActive,
        promo.promoType,
        promo.promoBuyQty,
        promo.promoGetQty,
        promo.promoGetIds,
      ],
    );
    const item = await one<MenuRow>(
      `SELECT m.*, c.name AS categoryName FROM menu_items m
       JOIN categories c ON c.id = m.categoryId WHERE m.id = ?`,
      [Number(created.lastInsertRowid)],
    );
    res.json(asAdminItem(item!));
  },
);

app.put("/api/admin/restaurants/:rid/menu/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const item = await one<MenuRow>("SELECT * FROM menu_items WHERE id = ?", [req.params.id]);
  if (!item || String(item.restaurantId) !== String(req.params.rid)) {
    fail(res, 404, "Item not found");
    return;
  }
  const b = req.body ?? {};
  let imageUrl = item.imageUrl;
  if (b.imageUrl !== undefined) {
    const next = remoteImageUrl(b.imageUrl);
    if (String(b.imageUrl).trim() && !next) {
      fail(res, 400, "Use a full image address starting with http:// or https://");
      return;
    }
    imageUrl = next;
  }
  const catId = b.categoryId ?? item.categoryId;
  if (catId !== item.categoryId) {
    const cat = await one<{ restaurantId: number }>("SELECT restaurantId FROM categories WHERE id = ?", [catId]);
    if (!cat || cat.restaurantId !== item.restaurantId) {
      fail(res, 400, "Pick a category from this restaurant");
      return;
    }
  }
  const promo = normalizePromoWrite(b, item as MenuRow);
  await run(
    `UPDATE menu_items SET name = ?, description = ?, categoryId = ?, basePrice = ?, adminMarkup = ?, isAvailable = ?, imageUrl = ?,
     promoActive = ?, promoType = ?, promoBuyQty = ?, promoGetQty = ?, promoGetIds = ?
     WHERE id = ?`,
    [
      b.name ?? item.name,
      b.description ?? item.description,
      catId,
      b.basePrice != null && String(b.basePrice) !== ""
        ? Math.max(0, money(b.basePrice))
        : money(item.basePrice),
      b.adminMarkup != null && String(b.adminMarkup) !== ""
        ? Math.max(0, money(b.adminMarkup))
        : money(item.adminMarkup),
      b.isAvailable == null ? item.isAvailable : b.isAvailable ? 1 : 0,
      imageUrl,
      promo.promoActive,
      promo.promoType,
      promo.promoBuyQty,
      promo.promoGetQty,
      promo.promoGetIds,
      item.id,
    ],
  );
  const updated = await one<MenuRow>(
    `SELECT m.*, c.name AS categoryName FROM menu_items m
     JOIN categories c ON c.id = m.categoryId WHERE m.id = ?`,
    [item.id],
  );
  res.json(asAdminItem(updated!));
});

app.post(
  "/api/admin/restaurants/:rid/menu/:id/image",
  requireAuth,
  requireRole("admin"),
  upload.single("image"),
  async (req, res) => {
    const item = await one<MenuRow>("SELECT * FROM menu_items WHERE id = ?", [req.params.id]);
    if (!item || String(item.restaurantId) !== String(req.params.rid)) {
      fail(res, 404, "Item not found");
      return;
    }
    if (!req.file) {
      fail(res, 400, "Upload a photo");
      return;
    }
    await run("UPDATE menu_items SET imageUrl = ? WHERE id = ?", [fileUrl(req.file.filename), item.id]);
    const updated = await one<MenuRow>(
      `SELECT m.*, c.name AS categoryName FROM menu_items m
       JOIN categories c ON c.id = m.categoryId WHERE m.id = ?`,
      [item.id],
    );
    res.json(asAdminItem(updated!));
  },
);

app.delete("/api/admin/restaurants/:rid/menu/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const item = await one<MenuRow>("SELECT * FROM menu_items WHERE id = ?", [req.params.id]);
  if (!item || String(item.restaurantId) !== String(req.params.rid)) {
    fail(res, 404, "Item not found");
    return;
  }
  await run("UPDATE order_items SET menuItemId = NULL WHERE menuItemId = ?", [item.id]);
  await run("DELETE FROM menu_items WHERE id = ?", [item.id]);
  res.json({ ok: true });
});

app.put("/api/admin/menu/:id/markup", requireAuth, requireRole("admin"), async (req, res) => {
  const markup = Math.max(0, Number(req.body?.adminMarkup) || 0);
  const item = await one<MenuRow>("SELECT * FROM menu_items WHERE id = ?", [req.params.id]);
  if (!item) {
    fail(res, 404, "Item not found");
    return;
  }
  await run("UPDATE menu_items SET adminMarkup = ? WHERE id = ?", [markup, item.id]);
  res.json({
    id: item.id,
    basePrice: money(item.basePrice),
    adminMarkup: markup,
    customerPrice: customerPrice(item.basePrice, markup),
  });
});

app.put(
  "/api/admin/restaurants/:id/markup-bulk",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    const markup = Math.max(0, Number(req.body?.adminMarkup) || 0);
    await run("UPDATE menu_items SET adminMarkup = ? WHERE restaurantId = ?", [
      markup,
      req.params.id,
    ]);
    res.json({ ok: true, adminMarkup: markup });
  },
);

async function geocodeAddress(address: string) {
  const query = `${address}, Kigali, Rwanda`.trim();
  if (!query) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "KigaliTasteFoodDelivery/1.0 (delivery@kigalitaste.rw)" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { lat: string; lon: string }[];
    if (!data[0]) return null;
    const lat = Number(data[0].lat);
    const lng = Number(data[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

function parseCoord(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

function validLat(lat: number) {
  return lat >= -90 && lat <= 90;
}

function validLng(lng: number) {
  return lng >= -180 && lng <= 180;
}

function trackingPayload(order: Record<string, unknown>) {
  const deliveryLat = parseCoord(order.deliveryLat);
  const deliveryLng = parseCoord(order.deliveryLng);
  const riderLat = parseCoord(order.riderLat);
  const riderLng = parseCoord(order.riderLng);
  const address = String(order.deliveryAddress || "");
  return {
    status: String(order.status || ""),
    deliveryAddress: address,
    deliveryLat,
    deliveryLng,
    riderLat,
    riderLng,
    riderLocationAt: order.riderLocationAt ? String(order.riderLocationAt) : null,
    mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
    directionsUrl:
      riderLat != null && riderLng != null && address
        ? `https://www.google.com/maps/dir/?api=1&origin=${riderLat},${riderLng}&destination=${encodeURIComponent(address)}`
        : null,
  };
}

async function orderPayload(orderId: number) {
  const order = await one<Record<string, unknown>>(
    `SELECT o.*, r.name AS restaurantName FROM orders o
     JOIN restaurants r ON r.id = o.restaurantId WHERE o.id = ?`,
    [orderId],
  );
  if (!order) return null;
  const items = await many(
    `SELECT nameSnapshot AS name, qty, basePriceSnapshot, markupSnapshot,
            (basePriceSnapshot + markupSnapshot) AS customerPrice
     FROM order_items WHERE orderId = ?`,
    [orderId],
  );
  return {
    ...order,
    items,
    total: (order.vendorAmount as number) + (order.platformAmount as number),
    discount: Number(order.discountAmount || 0),
    promoCode: order.promoCode ? String(order.promoCode) : null,
    deliveryLat: parseCoord(order.deliveryLat),
    deliveryLng: parseCoord(order.deliveryLng),
    riderLat: parseCoord(order.riderLat),
    riderLng: parseCoord(order.riderLng),
    riderLocationAt: order.riderLocationAt ? String(order.riderLocationAt) : null,
  } as Record<string, unknown> & { items: unknown[]; total: number };
}

app.get("/api/promos/featured", async (_req, res) => {
  res.json({ promo: publicPromoCard(await getFeaturedPromo()) });
});

app.get("/api/promos", async (_req, res) => {
  res.json({ promos: await listPublicPromos() });
});

app.get("/api/restaurants/:slug/promos", async (req, res) => {
  const restaurant = await one<{ id: number; name: string; slug: string }>(
    `SELECT r.id, r.name, r.slug FROM restaurants r
     JOIN vendors v ON v.id = r.vendorId
     WHERE r.slug = ? AND r.isLive = 1 AND v.status = 'APPROVED' AND v.suspended = 0`,
    [req.params.slug],
  );
  if (!restaurant) {
    fail(res, 404, "Restaurant not found");
    return;
  }
  res.json({
    restaurant: { id: restaurant.id, name: restaurant.name, slug: restaurant.slug },
    promos: await listRestaurantPromos(restaurant.id),
  });
});

app.get("/api/admin/promos", requireAuth, requireRole("admin"), async (_req, res) => {
  const rows = await listPromoCodes();
  res.json(
    rows.map((row) => ({
      ...row,
      restaurantId: row.restaurantId != null ? Number(row.restaurantId) : null,
      firstOrderOnly: Boolean(Number(row.firstOrderOnly)),
      isActive: Boolean(Number(row.isActive)),
    })),
  );
});

async function resolvePromoRestaurantId(raw: unknown) {
  if (raw === null || raw === undefined || raw === "" || raw === "all") return null;
  const id = Number(raw);
  if (!Number.isFinite(id) || id <= 0) return null;
  const restaurant = await one<{ id: number }>("SELECT id FROM restaurants WHERE id = ?", [id]);
  return restaurant ? restaurant.id : null;
}

app.post("/api/admin/promos", requireAuth, requireRole("admin"), async (req, res) => {
  const code = String(req.body?.code || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  if (!code || code.length < 3) {
    fail(res, 400, "Enter a promo code (at least 3 characters)");
    return;
  }
  const discountType = String(req.body?.discountType || "PERCENT").toUpperCase() === "FIXED" ? "FIXED" : "PERCENT";
  const discountValue = Math.max(0, Number(req.body?.discountValue) || 0);
  if (discountType === "PERCENT" && (discountValue < 1 || discountValue > 100)) {
    fail(res, 400, "Percent discount must be between 1 and 100");
    return;
  }
  if (discountType === "FIXED" && discountValue < 1) {
    fail(res, 400, "Fixed discount must be at least 1 FRw");
    return;
  }
  const existing = await one("SELECT id FROM promo_codes WHERE code = ?", [code]);
  if (existing) {
    fail(res, 400, "That promo code already exists");
    return;
  }
  const restaurantId = await resolvePromoRestaurantId(req.body?.restaurantId);
  if (req.body?.restaurantId && !restaurantId && req.body?.restaurantId !== null && req.body?.restaurantId !== "" && req.body?.restaurantId !== "all") {
    fail(res, 400, "Restaurant not found for this promo");
    return;
  }
  const created = await run(
    `INSERT INTO promo_codes(code, description, discountType, discountValue, minSubtotal, maxDiscount, firstOrderOnly, usageLimit, usedCount, isActive, restaurantId, startsAt, endsAt, createdAt)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
    [
      code,
      String(req.body?.description || "").trim().slice(0, 255),
      discountType,
      discountValue,
      Math.max(0, Number(req.body?.minSubtotal) || 0),
      req.body?.maxDiscount != null && req.body?.maxDiscount !== ""
        ? Math.max(0, Number(req.body.maxDiscount) || 0)
        : null,
      req.body?.firstOrderOnly ? 1 : 0,
      req.body?.usageLimit != null && req.body?.usageLimit !== ""
        ? Math.max(1, Number(req.body.usageLimit) || 1)
        : null,
      req.body?.isActive === false ? 0 : 1,
      restaurantId,
      req.body?.startsAt ? String(req.body.startsAt) : null,
      req.body?.endsAt ? String(req.body.endsAt) : null,
      now(),
    ],
  );
  const row = await one<PromoCodeRow>(
    `SELECT p.*, r.name AS restaurantName, r.slug AS restaurantSlug
     FROM promo_codes p LEFT JOIN restaurants r ON r.id = p.restaurantId WHERE p.id = ?`,
    [created.lastInsertRowid],
  );
  res.json(row);
});

app.put("/api/admin/promos/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const id = Number(req.params.id);
  const row = await one<PromoCodeRow>("SELECT * FROM promo_codes WHERE id = ?", [id]);
  if (!row) {
    fail(res, 404, "Promo not found");
    return;
  }
  const code = String(req.body?.code ?? row.code)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  if (!code || code.length < 3) {
    fail(res, 400, "Enter a promo code (at least 3 characters)");
    return;
  }
  const discountType =
    String(req.body?.discountType ?? row.discountType).toUpperCase() === "FIXED" ? "FIXED" : "PERCENT";
  const discountValue = Math.max(0, Number(req.body?.discountValue ?? row.discountValue) || 0);
  if (discountType === "PERCENT" && (discountValue < 1 || discountValue > 100)) {
    fail(res, 400, "Percent discount must be between 1 and 100");
    return;
  }
  const clash = await one<{ id: number }>("SELECT id FROM promo_codes WHERE code = ? AND id != ?", [code, id]);
  if (clash) {
    fail(res, 400, "That promo code already exists");
    return;
  }
  let restaurantId = row.restaurantId != null ? Number(row.restaurantId) : null;
  if (req.body?.restaurantId !== undefined) {
    restaurantId = await resolvePromoRestaurantId(req.body.restaurantId);
    if (
      req.body.restaurantId &&
      req.body.restaurantId !== null &&
      req.body.restaurantId !== "" &&
      req.body.restaurantId !== "all" &&
      !restaurantId
    ) {
      fail(res, 400, "Restaurant not found for this promo");
      return;
    }
  }
  await run(
    `UPDATE promo_codes SET code = ?, description = ?, discountType = ?, discountValue = ?, minSubtotal = ?,
     maxDiscount = ?, firstOrderOnly = ?, usageLimit = ?, isActive = ?, restaurantId = ?, startsAt = ?, endsAt = ?
     WHERE id = ?`,
    [
      code,
      String(req.body?.description ?? row.description).trim().slice(0, 255),
      discountType,
      discountValue,
      Math.max(0, Number(req.body?.minSubtotal ?? row.minSubtotal) || 0),
      req.body?.maxDiscount !== undefined
        ? req.body.maxDiscount === null || req.body.maxDiscount === ""
          ? null
          : Math.max(0, Number(req.body.maxDiscount) || 0)
        : row.maxDiscount,
      req.body?.firstOrderOnly !== undefined ? (req.body.firstOrderOnly ? 1 : 0) : row.firstOrderOnly,
      req.body?.usageLimit !== undefined
        ? req.body.usageLimit === null || req.body.usageLimit === ""
          ? null
          : Math.max(1, Number(req.body.usageLimit) || 1)
        : row.usageLimit,
      req.body?.isActive !== undefined ? (req.body.isActive ? 1 : 0) : row.isActive,
      restaurantId,
      req.body?.startsAt !== undefined ? (req.body.startsAt ? String(req.body.startsAt) : null) : row.startsAt,
      req.body?.endsAt !== undefined ? (req.body.endsAt ? String(req.body.endsAt) : null) : row.endsAt,
      id,
    ],
  );
  res.json(
    await one(
      `SELECT p.*, r.name AS restaurantName, r.slug AS restaurantSlug
       FROM promo_codes p LEFT JOIN restaurants r ON r.id = p.restaurantId WHERE p.id = ?`,
      [id],
    ),
  );
});

app.delete("/api/admin/promos/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const id = Number(req.params.id);
  const row = await one<{ id: number; code: string }>("SELECT id, code FROM promo_codes WHERE id = ?", [id]);
  if (!row) {
    fail(res, 404, "Promo not found");
    return;
  }
  await run("DELETE FROM promo_codes WHERE id = ?", [id]);
  res.json({ ok: true, deleted: row.code });
});

app.get("/api/admin/orders", requireAuth, requireRole("admin"), async (_req, res) => {
  const orders = await many<{ id: number }>("SELECT id FROM orders ORDER BY id DESC");
  res.json(await Promise.all(orders.map((o) => orderPayload(o.id))));
});

app.get("/api/admin/reviews", requireAuth, requireRole("admin"), async (_req, res) => {
  const rows = await many<{
    orderId: number;
    orderNumber: string;
    rating: number;
    reviewComment: string | null;
    reviewedAt: string | null;
    reviewVisible: number;
    customerName: string;
    customerEmail: string;
    restaurantName: string;
    restaurantId: number;
    createdAt: string;
  }>(
    `SELECT o.id AS orderId, o.orderNumber, o.rating, o.reviewComment, o.reviewedAt, o.reviewVisible,
            o.customerName, u.email AS customerEmail, r.name AS restaurantName, r.id AS restaurantId, o.createdAt
     FROM orders o
     JOIN users u ON u.id = o.customerId
     JOIN restaurants r ON r.id = o.restaurantId
     WHERE o.rating IS NOT NULL
     ORDER BY COALESCE(o.reviewedAt, o.createdAt) DESC`,
  );
  res.json(
    rows.map((row) => ({
      ...row,
      reviewVisible: Boolean(Number(row.reviewVisible)),
    })),
  );
});

app.put("/api/admin/reviews/:orderId", requireAuth, requireRole("admin"), async (req, res) => {
  const orderId = Number(req.params.orderId);
  if (!Number.isFinite(orderId) || orderId <= 0) {
    fail(res, 400, "Invalid review");
    return;
  }
  const order = await one<{ id: number; rating: number | null }>(
    "SELECT id, rating FROM orders WHERE id = ?",
    [orderId],
  );
  if (!order || order.rating == null) {
    fail(res, 404, "Review not found");
    return;
  }
  const rating = Number(req.body?.rating);
  if (rating < 1 || rating > 5) {
    fail(res, 400, "Rating must be between 1 and 5");
    return;
  }
  const comment = String(req.body?.reviewComment ?? req.body?.comment ?? "").trim().slice(0, 2000);
  const reviewVisible = req.body?.reviewVisible === false ? 0 : 1;
  await run(
    "UPDATE orders SET rating = ?, reviewComment = ?, reviewVisible = ?, reviewedAt = COALESCE(reviewedAt, ?) WHERE id = ?",
    [rating, comment || null, reviewVisible, now(), orderId],
  );
  res.json({ ok: true });
});

app.delete("/api/admin/reviews/:orderId", requireAuth, requireRole("admin"), async (req, res) => {
  const orderId = Number(req.params.orderId);
  const order = await one<{ id: number; orderNumber: string }>(
    "SELECT id, orderNumber FROM orders WHERE id = ? AND rating IS NOT NULL",
    [orderId],
  );
  if (!order) {
    fail(res, 404, "Review not found");
    return;
  }
  await run(
    "UPDATE orders SET rating = NULL, reviewComment = NULL, reviewedAt = NULL, reviewVisible = 1 WHERE id = ?",
    [orderId],
  );
  res.json({ ok: true, deleted: order.orderNumber });
});

app.post("/api/admin/orders/:id/status", requireAuth, requireRole("admin"), async (req, res) => {
  const order = await one<{
    id: number;
    status: string;
    paymentMethod: string;
    paymentStatus: string;
  }>("SELECT * FROM orders WHERE id = ?", [req.params.id]);
  if (!order) {
    fail(res, 404, "Order not found");
    return;
  }
  const status = String(req.body?.status || "");
  const deliveryNote = req.body?.deliveryNote;
  if (status === "CANCELLED") {
    await run("UPDATE orders SET status = 'CANCELLED' WHERE id = ?", [order.id]);
    notifyOrderStatusSafe(order.id, "CANCELLED");
    res.json(await orderPayload(order.id));
    return;
  }
  if (status === "OUT_FOR_DELIVERY") {
    if (order.status !== "READY") {
      fail(res, 400, "Start delivery only after the restaurant marks READY");
      return;
    }
    const full = await one<{
      id: number;
      deliveryAddress: string;
      deliveryLat: number | null;
      deliveryLng: number | null;
    }>("SELECT id, deliveryAddress, deliveryLat, deliveryLng FROM orders WHERE id = ?", [order.id]);
    const riderLat = parseCoord(req.body?.riderLat);
    const riderLng = parseCoord(req.body?.riderLng);
    let deliveryLat = parseCoord(full?.deliveryLat);
    let deliveryLng = parseCoord(full?.deliveryLng);
    if ((deliveryLat == null || deliveryLng == null) && full?.deliveryAddress) {
      const geo = await geocodeAddress(full.deliveryAddress);
      if (geo) {
        deliveryLat = geo.lat;
        deliveryLng = geo.lng;
      }
    }
    const ts =
      riderLat != null && riderLng != null && validLat(riderLat) && validLng(riderLng) ? now() : null;
    await run(
      `UPDATE orders SET status = 'OUT_FOR_DELIVERY', deliveryNote = COALESCE(?, deliveryNote),
       deliveryLat = COALESCE(?, deliveryLat), deliveryLng = COALESCE(?, deliveryLng),
       riderLat = COALESCE(?, riderLat), riderLng = COALESCE(?, riderLng),
       riderLocationAt = COALESCE(?, riderLocationAt)
       WHERE id = ?`,
      [
        deliveryNote ?? null,
        deliveryLat,
        deliveryLng,
        riderLat,
        riderLng,
        ts,
        order.id,
      ],
    );
    notifyOrderStatusSafe(order.id, "OUT_FOR_DELIVERY");
    res.json(await orderPayload(order.id));
    return;
  }
  if (status === "DELIVERED") {
    if (order.status !== "OUT_FOR_DELIVERY" && order.status !== "READY") {
      fail(res, 400, "Mark delivered after the food is ready");
      return;
    }
    if (order.paymentMethod !== "COD" && order.paymentStatus !== "PAID") {
      fail(res, 400, "Customer has not paid yet");
      return;
    }
    if (order.paymentMethod === "COD" && order.paymentStatus !== "PAID") {
      await run("UPDATE orders SET paymentStatus = 'PAID' WHERE id = ?", [order.id]);
      notifyOrderPaidSafe(order.id);
    }
    await run(
      "UPDATE orders SET status = 'DELIVERED', deliveryNote = COALESCE(?, deliveryNote) WHERE id = ?",
      [deliveryNote ?? null, order.id],
    );
    await creditWalletsIfNeeded(order.id);
    notifyOrderStatusSafe(order.id, "DELIVERED");
    res.json(await orderPayload(order.id));
    return;
  }
  fail(res, 400, "Admin can cancel, start delivery, or mark delivered");
});

app.delete("/api/admin/orders/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const order = await one<{ id: number; orderNumber: string }>("SELECT id, orderNumber FROM orders WHERE id = ?", [
    req.params.id,
  ]);
  if (!order) {
    fail(res, 404, "Order not found");
    return;
  }
  await deleteOrderById(order.id);
  res.json({ ok: true, deleted: order.orderNumber });
});

app.get("/api/admin/delivery", requireAuth, requireRole("admin"), async (_req, res) => {
  const orders = await many<{ id: number }>(
    "SELECT id FROM orders WHERE status IN ('READY','OUT_FOR_DELIVERY') ORDER BY id",
  );
  res.json(
    await Promise.all(
      orders.map(async (o) => {
        const payload = await orderPayload(o.id);
        const tracking = trackingPayload(payload!);
        return {
          ...payload,
          ...tracking,
        };
      }),
    ),
  );
});

app.post("/api/admin/orders/:id/location", requireAuth, requireRole("admin"), async (req, res) => {
  const order = await one<{ id: number; status: string }>("SELECT id, status FROM orders WHERE id = ?", [
    req.params.id,
  ]);
  if (!order) {
    fail(res, 404, "Order not found");
    return;
  }
  if (order.status !== "OUT_FOR_DELIVERY") {
    fail(res, 400, "Live location only while the order is out for delivery");
    return;
  }
  const lat = parseCoord(req.body?.lat);
  const lng = parseCoord(req.body?.lng);
  if (lat == null || lng == null || !validLat(lat) || !validLng(lng)) {
    fail(res, 400, "Send a valid latitude and longitude");
    return;
  }
  const ts = now();
  await run("UPDATE orders SET riderLat = ?, riderLng = ?, riderLocationAt = ? WHERE id = ?", [
    lat,
    lng,
    ts,
    order.id,
  ]);
  res.json({ ok: true, lat, lng, riderLocationAt: ts });
});

app.get("/api/orders/:id/tracking", requireAuth, async (req, res) => {
  const order = await one<Record<string, unknown>>(
    `SELECT o.*, r.name AS restaurantName FROM orders o
     JOIN restaurants r ON r.id = o.restaurantId WHERE o.id = ?`,
    [req.params.id],
  );
  if (!order) {
    fail(res, 404, "Order not found");
    return;
  }
  if (req.user!.role === "customer" && order.customerId !== req.user!.id) {
    fail(res, 403, "Not your order");
    return;
  }
  if (req.user!.role !== "customer" && req.user!.role !== "admin") {
    fail(res, 403, "Not allowed");
    return;
  }
  res.json({
    id: order.id,
    orderNumber: order.orderNumber,
    restaurantName: order.restaurantName,
    ...trackingPayload(order),
  });
});

app.get("/api/admin/wallet", requireAuth, requireRole("admin"), async (_req, res) => {
  await syncDeliveredWalletCredits();
  const stats = await walletStats("platform", 0);
  const commission = await platformCommission();
  const pending = await pendingPlatformEarnings();
  res.json({
    ...stats,
    earned: stats.collected,
    markupEarned: commission.markupEarned,
    deliveryEarned: commission.deliveryEarned,
    pendingEarnings: pending.total,
    pendingMarkup: pending.markup,
    pendingDelivery: pending.delivery,
    shopName: "Kigali Taste",
    live: true,
    paymentsReady: paymentsConfigured(),
    liveWallet: null,
    earnings: await many(
      "SELECT * FROM wallet_transactions WHERE ownerType = 'platform' ORDER BY id DESC",
    ),
    payouts: await many(
      `SELECT p.*, v.businessName, u.email FROM payout_requests p
       LEFT JOIN vendors v ON v.id = p.vendorId
       LEFT JOIN users u ON u.id = v.userId
       ORDER BY p.id DESC`,
    ),
  });
});

app.get("/api/admin/transactions", requireAuth, requireRole("admin"), async (_req, res) => {
  await syncDeliveredWalletCredits();
  const stats = await walletStats("platform", 0);
  const commission = await platformCommission();
  const pending = await pendingPlatformEarnings();
  res.json({
    earned: stats.collected,
    available: stats.available,
    paidOut: stats.paidOut,
    held: stats.held,
    markupEarned: commission.markupEarned,
    deliveryEarned: commission.deliveryEarned,
    pendingEarnings: pending.total,
    pendingMarkup: pending.markup,
    pendingDelivery: pending.delivery,
    transactions: await platformTransactionFeed(),
  });
});

app.post("/api/admin/payouts", requireAuth, requireRole("admin"), async (req, res) => {
  if (!req.body?.confirmed) {
    fail(res, 400, "Tick the box to confirm this payout");
    return;
  }
  const expectedName = String(req.body?.expectedName || req.body?.name || "").trim();
  const recipientName = String(req.body?.recipientName || "").trim();
  let ready;
  try {
    ready = preparePayout(
      String(req.body?.msisdn || ""),
      req.body?.amount,
      String(req.body?.telecomProviderId || ""),
    );
  } catch (err) {
    fail(res, 400, (err as Error).message);
    return;
  }
  try {
    requireMatchedPayoutName(ready.local, ready.amount, ready.providerId, recipientName || expectedName);
  } catch (err) {
    fail(res, 400, (err as Error).message);
    return;
  }
  if (!recipientName) {
    fail(res, 400, "Validate the registered name before sending");
    return;
  }
  const available = (await walletStats("platform", 0)).available;
  if (ready.amount > available) {
    fail(res, 400, "That is more than the markup and commission available");
    return;
  }
  const methodNote = `${ready.providerName} ${ready.local}`;
  const created = await run(
    `INSERT INTO payout_requests(vendorId, ownerType, amount, methodNote, status, msisdn, recipientName, telecomProviderId, createdAt)
     VALUES(NULL, 'platform', ?, ?, 'REQUESTED', ?, ?, ?, ?)`,
    [ready.amount, methodNote, ready.local, recipientName, ready.providerId, now()],
  );
  const payoutId = Number(created.lastInsertRowid);
  if (paymentsConfigured()) {
    try {
      res.json(await dispatchPayout(payoutId, recipientName));
      return;
    } catch (err) {
      await run("UPDATE payout_requests SET status = 'FAILED', adminNote = ? WHERE id = ?", [
        (err as Error).message,
        payoutId,
      ]);
      fail(res, 502, (err as Error).message || "Payout could not be sent on XentriPay");
      return;
    }
  }
  res.json({
    id: payoutId,
    status: "REQUESTED",
    message: "Commission payout saved. Send it when XentriPay is available.",
  });
});

app.post("/api/admin/payouts/:id/pay", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const payout = await one<{
      id: number;
      amount: number;
      msisdn: string | null;
      telecomProviderId: string | null;
    }>("SELECT * FROM payout_requests WHERE id = ?", [req.params.id]);
    if (!payout?.msisdn) {
      throw new Error("This payout has no MoMo number");
    }
    const ready = preparePayout(payout.msisdn, payout.amount, payout.telecomProviderId || "");
    requireMatchedPayoutName(
      ready.local,
      ready.amount,
      ready.providerId,
      String(req.body?.expectedName || req.body?.name || req.body?.recipientName || ""),
    );
    res.json(await dispatchPayout(Number(req.params.id), String(req.body?.recipientName || "")));
  } catch (err) {
    const message = (err as Error).message || "Payout could not be sent";
    if (message !== "Payout is not waiting") {
      await run("UPDATE payout_requests SET status = 'FAILED', adminNote = ? WHERE id = ?", [
        message,
        req.params.id,
      ]).catch(() => undefined);
    }
    fail(res, message.includes("not waiting") || message.includes("no MoMo") || message.includes("name") ? 400 : 502, message);
  }
});

app.post("/api/admin/payouts/:id/status", requireAuth, requireRole("admin"), async (req, res) => {
  const payout = await one<{ id: number; customerReference: string | null; status: string }>(
    "SELECT * FROM payout_requests WHERE id = ?",
    [req.params.id],
  );
  if (!payout) {
    fail(res, 404, "Payout not found");
    return;
  }
  const result = await refreshPayout(payout);
  res.json({ ok: true, ...result });
});

app.post("/api/admin/payouts/:id/reject", requireAuth, requireRole("admin"), async (req, res) => {
  const reason = String(req.body?.adminNote || "Rejected");
  await run("UPDATE payout_requests SET status = 'REJECTED', adminNote = ? WHERE id = ? AND status = 'REQUESTED'", [
    reason,
    req.params.id,
  ]);
  res.json({ ok: true });
});

app.post("/api/admin/withdraw", requireAuth, requireRole("admin"), async (req, res) => {
  const amount = Number(req.body?.amount);
  const note = String(req.body?.note || "Admin withdrawal");
  if (!amount || amount <= 0) {
    fail(res, 400, "Enter an amount");
    return;
  }
  const balance = await walletBalance("platform", 0);
  if (amount > balance) {
    fail(res, 400, "Not enough platform balance");
    return;
  }
  await run(
    `INSERT INTO wallet_transactions(ownerType, ownerId, \`type\`, amount, note, createdAt)
     VALUES('platform', 0, 'WITHDRAWAL', ?, ?, ?)`,
    [amount, note, now()],
  );
  res.json({ ok: true, balance: await walletBalance("platform", 0) });
});

app.get("/api/admin/subscribers", requireAuth, requireRole("admin"), async (_req, res) => {
  const rows = await many<{ id: number; email: string; subscribedAt: string; source: string }>(
    "SELECT id, email, subscribedAt, source FROM newsletter_subscribers ORDER BY id DESC LIMIT 500",
  );
  res.json(rows);
});

app.delete("/api/admin/subscribers/:id", requireAuth, requireRole("admin"), async (req, res) => {
  await run("DELETE FROM newsletter_subscribers WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});

app.get("/api/admin/mailbox/stats", requireAuth, requireRole("admin"), async (_req, res) => {
  void syncMailboxInboxSafe();
  const rows = await many<{ folder: string; isRead: number; c: number }>(
    "SELECT folder, isRead, COUNT(*) AS c FROM mailbox_messages GROUP BY folder, isRead",
  );
  const stats: Record<string, { total: number; unread: number }> = {
    inbox: { total: 0, unread: 0 },
    sent: { total: 0, unread: 0 },
    archived: { total: 0, unread: 0 },
    trash: { total: 0, unread: 0 },
    all: { total: 0, unread: 0 },
  };
  for (const row of rows) {
    const key = row.folder in stats ? row.folder : row.folder;
    if (!stats[key]) stats[key] = { total: 0, unread: 0 };
    stats[key].total += row.c;
    if (!row.isRead) stats[key].unread += row.c;
    if (row.folder !== "trash") {
      stats.all.total += row.c;
      if (!row.isRead) stats.all.unread += row.c;
    }
  }
  res.json({ ...stats, sync: await mailboxSyncStatus() });
});

app.post("/api/admin/mailbox/sync", requireAuth, requireRole("admin"), async (_req, res) => {
  const result = await syncMailboxInboxSafe();
  if (!result.ok) {
    fail(res, 502, result.error || "Mailbox sync failed");
    return;
  }
  res.json({ ...result, sync: await mailboxSyncStatus() });
});

app.get("/api/admin/mailbox/sync-status", requireAuth, requireRole("admin"), async (_req, res) => {
  res.json(await mailboxSyncStatus());
});

app.get("/api/admin/mailbox/attachments/:attachmentId", requireAuth, requireRole("admin"), async (req, res) => {
  const att = await getMailboxAttachment(Number(req.params.attachmentId));
  if (!att) {
    fail(res, 404, "Attachment not found");
    return;
  }
  const filePath = attachmentFilePath(att.storedName);
  if (!existsSync(filePath)) {
    fail(res, 404, "Attachment file missing");
    return;
  }
  const inline = req.query.inline === "1" || attachmentCanPreview(att.mimeType);
  res.setHeader("Content-Type", att.mimeType || "application/octet-stream");
  res.setHeader(
    "Content-Disposition",
    `${inline ? "inline" : "attachment"}; filename="${att.filename.replace(/"/g, "")}"`,
  );
  res.send(readFileSync(filePath));
});

app.get("/api/admin/mailbox/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const msg = await one<Record<string, unknown>>("SELECT * FROM mailbox_messages WHERE id = ?", [req.params.id]);
  if (!msg) {
    fail(res, 404, "Message not found");
    return;
  }
  const rootId = Number(msg.parentId || msg.id);
  const thread = await many(
    "SELECT * FROM mailbox_messages WHERE id = ? OR parentId = ? ORDER BY id ASC",
    [rootId, rootId],
  );
  const messageIds = thread.map((row) => Number((row as { id: number }).id));
  const attachments = await listAttachmentsForMessages(messageIds);
  res.json({ message: msg, thread, attachments });
});

app.get("/api/admin/mailbox", requireAuth, requireRole("admin"), async (req, res) => {
  void syncMailboxInboxSafe();
  const folder = String(req.query.folder || "inbox");
  const q = String(req.query.q || "").trim();
  const unreadOnly = String(req.query.unread || "") === "1";
  const params: (string | number)[] = [];
  let sql = "SELECT * FROM mailbox_messages WHERE 1=1";
  if (folder === "all") {
    sql += " AND folder != 'trash'";
  } else {
    sql += " AND folder = ?";
    params.push(folder);
  }
  if (unreadOnly) sql += " AND isRead = 0";
  if (q) {
    sql += " AND (subject LIKE ? OR body LIKE ? OR fromEmail LIKE ? OR fromName LIKE ? OR toEmail LIKE ?)";
    const like = `%${q}%`;
    params.push(like, like, like, like, like);
  }
  sql += " ORDER BY id DESC LIMIT 500";
  res.json(await many(sql, params));
});

app.post("/api/admin/mailbox/:id/read", requireAuth, requireRole("admin"), async (req, res) => {
  const isRead = req.body?.isRead === false ? 0 : 1;
  await run("UPDATE mailbox_messages SET isRead = ? WHERE id = ?", [isRead, req.params.id]);
  res.json({ ok: true });
});

app.post("/api/admin/mailbox/:id/archive", requireAuth, requireRole("admin"), async (req, res) => {
  await run("UPDATE mailbox_messages SET folder = 'archived' WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});

app.post("/api/admin/mailbox/:id/trash", requireAuth, requireRole("admin"), async (req, res) => {
  await run("UPDATE mailbox_messages SET folder = 'trash' WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});

app.post("/api/admin/mailbox/reply", requireAuth, requireRole("admin"), mailUpload.array("attachments", 5), async (req, res) => {
  const parent = await one<{
    id: number;
    fromEmail: string;
    fromName: string;
    subject: string;
  }>("SELECT * FROM mailbox_messages WHERE id = ?", [req.body?.parentId]);
  if (!parent) {
    fail(res, 404, "Message not found");
    return;
  }
  const htmlBody = String(req.body?.htmlBody || "").trim();
  const body = String(req.body?.body || "").trim() || htmlBody.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!body && !htmlBody) {
    fail(res, 400, "Write a reply");
    return;
  }
  const replySubject = parent.subject.startsWith("Re:") ? parent.subject : `Re: ${parent.subject}`;
  const fromEmail = businessNotifyEmail();
  const replyTo = String(req.body?.replyTo || fromEmail).trim() || fromEmail;
  const bcc = parseEmailList(req.body?.bcc);
  const attachments = mailAttachmentPayload(req.files as Express.Multer.File[] | undefined);
  try {
    await sendMailboxEmail({
      to: parent.fromEmail,
      subject: replySubject,
      body,
      htmlBody: htmlBody || undefined,
      replyTo,
      bcc: bcc.length ? bcc : undefined,
      attachments: attachments.length ? attachments : undefined,
    });
  } catch (err) {
    fail(res, 502, (err as Error).message || "Could not send reply email");
    return;
  }
  const toUser = await one<{ id: number }>("SELECT id FROM users WHERE email = ?", [parent.fromEmail]);
  const sent = await run(
    `INSERT INTO mailbox_messages(folder, fromEmail, fromName, toUserId, toEmail, subject, body, isRead, parentId, createdAt)
     VALUES('sent', ?, 'Kigali Taste', ?, ?, ?, ?, 1, ?, ?)`,
    [fromEmail, toUser?.id ?? null, parent.fromEmail, replySubject, body, parent.id, now()],
  );
  const uploadFiles = (req.files as Express.Multer.File[] | undefined) || [];
  if (uploadFiles.length) {
    await saveUploadedAttachments(Number(sent.lastInsertRowid), uploadFiles);
  }
  await run("UPDATE mailbox_messages SET isRead = 1 WHERE id = ?", [parent.id]);
  res.json({ ok: true });
});

app.post("/api/admin/mailbox/compose", requireAuth, requireRole("admin"), mailUpload.array("attachments", 5), async (req, res) => {
  const recipients = parseEmailList(req.body?.toEmail);
  if (!recipients.length) {
    fail(res, 400, "Enter at least one valid recipient email");
    return;
  }
  const subject = String(req.body?.subject || "").trim();
  const htmlBody = String(req.body?.htmlBody || "").trim();
  const body = String(req.body?.body || "").trim() || htmlBody.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!subject || (!body && !htmlBody)) {
    fail(res, 400, "Subject and message are required");
    return;
  }
  const fromEmail = businessNotifyEmail();
  const replyTo = String(req.body?.replyTo || fromEmail).trim() || fromEmail;
  const bcc = parseEmailList(req.body?.bcc);
  const attachments = mailAttachmentPayload(req.files as Express.Multer.File[] | undefined);
  const toField = recipients.join(", ");
  try {
    await sendMailboxEmail({
      to: recipients.length === 1 ? recipients[0] : recipients,
      subject,
      body,
      htmlBody: htmlBody || undefined,
      replyTo,
      bcc: bcc.length ? bcc : undefined,
      attachments: attachments.length ? attachments : undefined,
    });
  } catch (err) {
    fail(res, 502, (err as Error).message || "Could not send email");
    return;
  }
  for (const toEmail of recipients) {
    const toUser = await one<{ id: number }>("SELECT id FROM users WHERE email = ?", [toEmail]);
    const sent = await run(
      `INSERT INTO mailbox_messages(folder, fromEmail, fromName, toUserId, toEmail, subject, body, isRead, createdAt)
       VALUES('sent', ?, 'Kigali Taste', ?, ?, ?, ?, 1, ?)`,
      [fromEmail, toUser?.id ?? null, toEmail, subject, body, now()],
    );
    const uploadFiles = (req.files as Express.Multer.File[] | undefined) || [];
    if (uploadFiles.length) {
      await saveUploadedAttachments(Number(sent.lastInsertRowid), uploadFiles);
    }
  }
  res.json({ ok: true, sent: true, to: toField });
});

app.get("/api/admin/delivery-zones", requireAuth, requireRole("admin"), async (_req, res) => {
  res.json(await listDeliveryZones(false));
});

app.post("/api/admin/delivery-zones", requireAuth, requireRole("admin"), async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const keywords = String(req.body?.keywords || "").trim();
  const fee = Math.max(0, Number(req.body?.fee) || 0);
  if (!name) {
    fail(res, 400, "Area name is required");
    return;
  }
  if (!keywords) {
    fail(res, 400, "Add search keywords for this area");
    return;
  }
  const created = await run(
    "INSERT INTO delivery_zones(name, keywords, fee, sort, isActive) VALUES(?, ?, ?, ?, ?)",
    [name, keywords, fee, Number(req.body?.sort) || 0, req.body?.isActive === false ? 0 : 1],
  );
  res.json(await one<DeliveryZoneRow>("SELECT * FROM delivery_zones WHERE id = ?", [
    Number(created.lastInsertRowid),
  ]));
});

app.put("/api/admin/delivery-zones/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const zone = await one<DeliveryZoneRow>("SELECT * FROM delivery_zones WHERE id = ?", [req.params.id]);
  if (!zone) {
    fail(res, 404, "Area not found");
    return;
  }
  const name = req.body?.name != null ? String(req.body.name).trim() : zone.name;
  const keywords = req.body?.keywords != null ? String(req.body.keywords).trim() : zone.keywords;
  const fee = req.body?.fee != null ? Math.max(0, Number(req.body.fee) || 0) : zone.fee;
  if (!name || !keywords) {
    fail(res, 400, "Area name and keywords are required");
    return;
  }
  await run(
    "UPDATE delivery_zones SET name = ?, keywords = ?, fee = ?, sort = ?, isActive = ? WHERE id = ?",
    [
      name,
      keywords,
      fee,
      req.body?.sort != null ? Number(req.body.sort) : zone.sort,
      req.body?.isActive === false ? 0 : req.body?.isActive === true ? 1 : zone.isActive,
      zone.id,
    ],
  );
  res.json(await one<DeliveryZoneRow>("SELECT * FROM delivery_zones WHERE id = ?", [zone.id]));
});

app.delete("/api/admin/delivery-zones/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const zone = await one<{ id: number }>("SELECT id FROM delivery_zones WHERE id = ?", [req.params.id]);
  if (!zone) {
    fail(res, 404, "Area not found");
    return;
  }
  await run("DELETE FROM delivery_zones WHERE id = ?", [zone.id]);
  res.json({ ok: true });
});

app.post("/api/admin/delivery-zones/test", requireAuth, requireRole("admin"), async (req, res) => {
  const address = String(req.body?.address || "").trim();
  if (!address) {
    fail(res, 400, "Enter an address to test");
    return;
  }
  res.json(await resolveDeliveryQuote(address, req.body?.lat, req.body?.lng));
});

app.put("/api/admin/settings", requireAuth, requireRole("admin"), async (req, res) => {
  const allowed = [
    "platformName",
    "logoUrl",
    "faviconUrl",
    "phone",
    "email",
    "whatsapp",
    "address",
    "facebook",
    "instagram",
    "deliveryFee",
    "orderPrefix",
    "terms",
    ...HERO_SETTING_KEYS,
    ...ABOUT_SETTING_KEYS,
    ...FAQ_SETTING_KEYS,
    ...SHIPPING_SETTING_KEYS,
    ...NEWSLETTER_SETTING_KEYS,
  ];
  for (const key of allowed) {
    if (req.body?.[key] != null) await setSetting(key, String(req.body[key]));
  }
  res.json(await settingsMap());
});

app.post(
  "/api/admin/settings/logo",
  requireAuth,
  requireRole("admin"),
  upload.single("file"),
  async (req, res) => {
    if (!req.file) {
      fail(res, 400, "Upload a logo");
      return;
    }
    const url = fileUrl(req.file.filename);
    const kind = String(req.body?.kind || "logo");
    const key = UPLOAD_KIND_TO_SETTING[kind] || "logoUrl";
    await setSetting(key, url);
    // Keep browser tab icon in sync with the platform logo unless a custom favicon is set.
    if (key === "logoUrl") {
      const existingFavicon = await setting("faviconUrl", "");
      if (!String(existingFavicon || "").trim()) {
        await setSetting("faviconUrl", url);
      }
    }
    res.json({ url, key });
  },
);

// Production: serve built SPA from ./public when present (cPanel single-app deploy).
const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
if (existsSync(path.join(publicDir, "index.html"))) {
  app.use(express.static(publicDir, { index: false, maxAge: "1h" }));
  app.get(/^(?!\/api(?:\/|$)|\/uploads(?:\/|$)).*/, (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });
}

app.use((err: Error, _req: Request, res: Response, _next: () => void) => {
  console.error(err);
  if (err instanceof MulterError) {
    fail(res, 400, err.code === "LIMIT_FILE_SIZE" ? "That file is too large (max 8 MB)" : "Upload failed. Try another file.");
    return;
  }
  const msg = err.message || "";
  if (/jpeg|png|webp|gif|pdf/i.test(msg)) {
    fail(res, 400, msg);
    return;
  }
  if (msg.includes("Unexpected token") || msg.includes("JSON")) {
    fail(res, 400, "Invalid request body");
    return;
  }
  fail(res, 500, "Something went wrong. Try again.");
});

export default app;
