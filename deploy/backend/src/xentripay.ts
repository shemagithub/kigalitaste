import { createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { now, one, run } from "./db.ts";
import { notifyOrderPaidSafe } from "./mail.ts";

function loadEnv() {
  try {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    const text = readFileSync(path.join(root, ".env"), "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq);
      const value = trimmed.slice(eq + 1).replace(/^['"]|['"]$/g, "").trim();
      if (key.startsWith("XENTRIPAY_") || !process.env[key]) process.env[key] = value;
    }
  } catch {
    /* .env already loaded by db.ts */
  }
}
loadEnv();

const LIVE_BASE = "https://xentripay.com";

const BASE = () => {
  const raw = (process.env.XENTRIPAY_BASE_URL || LIVE_BASE).replace(/\/$/, "");
  if (!raw || raw.includes("merchant.test")) return LIVE_BASE;
  return raw;
};
const KEY = () => String(process.env.XENTRIPAY_API_KEY || "").trim();

export const PROVIDERS = [
  { id: "63510", name: "MTN Mobile Money" },
  { id: "63514", name: "Airtel Rwanda" },
] as const;

export function paymentsConfigured() {
  return Boolean(KEY());
}

export function publicAppUrl() {
  return (process.env.PUBLIC_APP_URL || "http://localhost:5173").replace(/\/$/, "");
}

/** Public URL XentriPay redirects to after card payment. Use your live HTTPS domain in production. */
export function paymentPublicUrl() {
  return (process.env.PAYMENT_PUBLIC_URL || process.env.PUBLIC_APP_URL || "http://localhost:5173").replace(
    /\/$/,
    "",
  );
}

function isProductionGateway() {
  const base = BASE();
  return base.includes("xentripay.com") && !base.includes("merchant.test");
}

export function orderPaymentUrls(orderId: number) {
  const base = paymentPublicUrl();
  const finalUrl = `${base}/pay?order=${orderId}`;
  const gatewayReturn = `${base}/pay?order=${orderId}&card=return`;
  validatePaymentRedirectUrl(finalUrl);
  validatePaymentRedirectUrl(gatewayReturn);
  return { finalUrl, gatewayReturn };
}

function validatePaymentRedirectUrl(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(
      `Invalid payment return URL "${url}". Set PAYMENT_PUBLIC_URL or PUBLIC_APP_URL to your live site (https://yourdomain.com).`,
    );
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Payment return URL must use http or https.");
  }
  const localhost = /^(localhost|127\.0\.0\.1)$/i.test(parsed.hostname);
  if (isProductionGateway() && localhost) {
    throw new Error(
      "XentriPay live card payments need a public HTTPS return URL, not localhost. Set PAYMENT_PUBLIC_URL=https://yourdomain.com in backend/.env to your deployed site.",
    );
  }
  if (isProductionGateway() && parsed.protocol !== "https:") {
    throw new Error(
      "XentriPay live card payments require HTTPS return URLs. Set PAYMENT_PUBLIC_URL=https://yourdomain.com in backend/.env.",
    );
  }
}

export function rwandaPhones(input: string) {
  let digits = String(input || "").replace(/\D/g, "");
  if (digits.startsWith("250") && digits.length >= 12) digits = `0${digits.slice(3, 13)}`;
  if (digits.length === 9 && /^[7-9]/.test(digits)) digits = `0${digits}`;
  if (!/^07\d{8}$/.test(digits)) {
    throw new Error("Use a Rwanda Mobile Money number like 078xxxxxxx");
  }
  return {
    cnumber: digits,
    msisdn: `250${digits.slice(1)}`,
    local: digits,
  };
}

export function guessProviderId(local: string) {
  if (local.startsWith("073") || local.startsWith("072")) return "63514";
  return "63510";
}

export function verifyWebhookSignature(raw: Buffer, secret: string, header: string) {
  if (!secret || !header) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
  const a = Buffer.from(header, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function xpMessage(data: Record<string, unknown>, status: number, raw: string) {
  const text =
    String(data.message || data.error || data.reply || data.statusMessage || "").trim() ||
    raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
  if (status === 401 || status === 403) {
    return text && !/^invalid or disabled api key$/i.test(text)
      ? text
      : "XentriPay rejected this live API key. Open the XentriPay dashboard, copy a live production key into backend/.env, then restart the API.";
  }
  if (status >= 500) {
    return text || "XentriPay is unavailable. Try again or pay at pickup.";
  }
  return text || `XentriPay error ${status}`;
}

async function xpOnce<T>(base: string, path: string, init: RequestInit, key: string, timeoutMs = 15000): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(timeoutMs),
    headers: {
      "Content-Type": "application/json",
      "X-XENTRIPAY-KEY": key,
    },
  });
  const raw = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    data = { message: raw.slice(0, 180) };
  }
  if (!res.ok) {
    console.error("XentriPay", res.status, path, String(data.message || data.error || "").slice(0, 120));
    const err = new Error(xpMessage(data, res.status, raw)) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return data as T;
}

function isAbortError(err: unknown) {
  const name = (err as { name?: string }).name || "";
  const message = (err as { message?: string }).message || "";
  return name === "TimeoutError" || name === "AbortError" || /aborted|timeout/i.test(message);
}

async function xp<T>(path: string, init: RequestInit = {}, timeoutMs = 25000): Promise<T> {
  const key = KEY();
  if (!key) {
    throw new Error("XentriPay is not configured. Add XENTRIPAY_API_KEY in backend/.env");
  }
  try {
    return await xpOnce<T>(BASE(), path, init, key, timeoutMs);
  } catch (err) {
    if (isAbortError(err)) {
      throw new Error("XentriPay took too long. Try again.");
    }
    throw err;
  }
}

export type CollectionInit = {
  reply?: string;
  url?: string | null;
  success?: number;
  authkey?: string;
  tid?: string;
  refid?: string;
  retcode?: number;
};

export async function initiateCollection(body: Record<string, unknown>) {
  const data = await xp<CollectionInit>("/api/collections/initiate", {
    method: "POST",
    body: JSON.stringify({
      ...body,
      amount: Math.round(Number(body.amount)),
      currency: "RWF",
      chargesIncluded: body.chargesIncluded !== false,
    }),
  });
  if (data.success === 0 || (data.retcode != null && data.retcode !== 0)) {
    throw new Error(data.reply || "Payment request was not accepted");
  }
  return data;
}

export async function collectionStatus(reference: string) {
  return xp<{ customerRef?: string; rid?: string; status?: string; updatedAt?: string }>(
    `/api/collections/status/${encodeURIComponent(reference)}`,
  );
}

export async function createCheckoutSession(amount: number, customerFinalUrl: string) {
  return xp<{ id: string; checkoutUrl: string; status: string }>("/api/checkout/sessions", {
    method: "POST",
    body: JSON.stringify({ amount, customerFinalUrl, currency: "RWF" }),
  });
}

export async function payCheckoutSession(sessionId: string, body: Record<string, unknown>) {
  const data = await xp<{
    status?: string;
    redirectTo?: string;
    gatewayUrl?: string | null;
    paymentMethod?: string;
    refid?: string;
    reply?: string;
    success?: number;
    retcode?: number;
  }>(`/api/checkout/sessions/${encodeURIComponent(sessionId)}/pay`, {
    method: "POST",
    body: JSON.stringify({
      ...body,
      currency: body.currency || "RWF",
      chargesIncluded: body.chargesIncluded !== false,
    }),
  });
  if (data.success === 0 || (data.retcode != null && data.retcode !== 0)) {
    throw new Error(data.reply || "Card payment could not be started");
  }
  return data;
}

export async function startCardCheckoutPayment(opts: {
  orderId: number;
  orderNumber: string;
  amount: number;
  user: { email: string; firstName: string; lastName: string };
  phone: string;
}) {
  const phones = rwandaPhones(opts.phone);
  const customerRef = `${opts.orderNumber}-${Date.now()}`;
  const name = `${opts.user.firstName} ${opts.user.lastName}`.trim();
  const amount = Math.round(opts.amount);
  if (amount < 100) {
    throw new Error("Amount must be at least 100 RWF");
  }

  const { finalUrl, gatewayReturn } = orderPaymentUrls(opts.orderId);
  const session = await createCheckoutSession(amount, finalUrl);
  const pay = await payCheckoutSession(session.id, {
    customerRef,
    email: opts.user.email,
    cname: name || "Kigali Taste customer",
    cnumber: phones.cnumber,
    msisdn: phones.msisdn,
    details: `Kigali Taste ${opts.orderNumber}`,
    pmethod: "cc",
    gatewayRedirectUrl: gatewayReturn,
  });

  const gatewayUrl = pay.gatewayUrl || session.checkoutUrl;
  if (!gatewayUrl) {
    throw new Error("Card payment page was not returned by XentriPay");
  }

  return {
    customerRef,
    sessionId: session.id,
    refid: pay.refid || customerRef,
    tid: null as string | null,
    gatewayUrl,
    message: "Continue on the secure card page. We never collect your card number here.",
  };
}

export async function startWalletCollectionPayment(opts: {
  orderNumber: string;
  amount: number;
  user: { email: string; firstName: string; lastName: string };
  phone: string;
  method: "MOMO" | "AIRTEL";
}) {
  const phones = rwandaPhones(opts.phone);
  const customerRef = `${opts.orderNumber}-${Date.now()}`;
  const name = `${opts.user.firstName} ${opts.user.lastName}`.trim();
  const amount = Math.round(opts.amount);
  if (amount < 100) {
    throw new Error("Amount must be at least 100 RWF");
  }

  const col = await initiateCollection({
    email: opts.user.email,
    cname: name || "Kigali Taste customer",
    amount,
    cnumber: phones.cnumber,
    msisdn: phones.msisdn,
    pmethod: "momo",
    customerRef,
    details: `Kigali Taste ${opts.orderNumber}`,
  });

  return {
    customerRef,
    sessionId: col.refid || null,
    refid: col.refid || customerRef,
    tid: col.tid || null,
    gatewayUrl: col.url || null,
    message:
      col.reply ||
      (opts.method === "AIRTEL"
        ? "Approve the Airtel Money prompt on your phone."
        : "Approve the MoMo prompt on your phone. Dial *182*7*1# if you do not see it."),
  };
}

export async function checkoutStatus(refid: string) {
  return xp<{ refid?: string; status?: string }>(
    `/api/checkout/sessions/status/${encodeURIComponent(refid)}`,
  );
}

export function payoutReference() {
  return `PAY-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

export function preparePayout(msisdn: string, amount: unknown, telecomProviderId?: string) {
  const phones = rwandaPhones(msisdn);
  const value = Math.round(Number(amount));
  if (!Number.isFinite(value) || value < 100) {
    throw new Error("Amount must be at least 100 RWF");
  }
  const provider = String(telecomProviderId || guessProviderId(phones.local));
  if (provider !== "63510" && provider !== "63514") {
    throw new Error("Use MTN Mobile Money (63510) or Airtel Rwanda (63514)");
  }
  return {
    local: phones.local,
    providerId: provider,
    providerName: provider === "63514" ? "Airtel Rwanda" : "MTN Mobile Money",
    amount: value,
  };
}

function pickName(data: unknown, depth = 0): string {
  if (depth > 5 || data == null || typeof data !== "object") return "";
  const obj = data as Record<string, unknown>;
  const keys = [
    "validatedAccountName",
    "registeredName",
    "accountName",
    "accountHolderName",
    "holderName",
    "beneficiaryName",
    "customerName",
    "fullName",
    "name",
  ];
  for (const key of keys) {
    const value = String(obj[key] || "").trim();
    if (value && value.toLowerCase() !== "recipient") return value;
  }
  for (const value of Object.values(obj)) {
    const nested = pickName(value, depth + 1);
    if (nested) return nested;
  }
  return "";
}

export function parseRegisteredNameHint(message: string) {
  const text = String(message || "").trim();
  if (!text) return "";
  const patterns = [
    /correct registered name is\s*:?\s*(.+)/i,
    /registered name is\s*:?\s*(.+)/i,
    /account name is\s*:?\s*(.+)/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match?.[1]) return match[1].trim().replace(/[.\s]+$/, "");
  }
  return "";
}

function storeNameDraft(
  ready: { local: string; providerId: string; amount: number },
  registered: string,
  sent?: Partial<NameDraft>,
) {
  const draft: NameDraft = {
    customerReference: sent?.customerReference || "",
    internalRef: sent?.internalRef || null,
    name: registered,
    local: ready.local,
    providerId: ready.providerId,
    amount: ready.amount,
    status: sent?.status || "LOOKUP",
    statusMessage:
      sent?.statusMessage ||
      "Registered name loaded. Confirm the payout, then approve the OTP sent to the XentriPay business email or phone.",
  };
  nameDrafts.set(draftKey(ready.local, ready.amount, ready.providerId), draft);
  return draft;
}

type NameDraft = {
  customerReference: string;
  internalRef: string | null;
  name: string;
  local: string;
  providerId: string;
  amount: number;
  status: string;
  statusMessage: string;
};

const nameDrafts = new Map<string, NameDraft>();

function draftKey(local: string, amount: number, providerId: string) {
  return `${local}:${amount}:${providerId}`;
}

export function peekNameDraft(local: string, amount: number, providerId: string) {
  return nameDrafts.get(draftKey(local, amount, providerId)) || null;
}

export function consumeNameDraft(local: string, amount: number, providerId: string) {
  const key = draftKey(local, amount, providerId);
  const draft = nameDrafts.get(key);
  if (draft) nameDrafts.delete(key);
  return draft || null;
}

export function namesMatch(a: string, b: string) {
  const clean = (value: string) =>
    String(value || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, " ")
      .trim();
  const left = clean(a);
  const right = clean(b);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

export async function lookupMomoName(
  msisdn: string,
  amount: unknown,
  telecomProviderId?: string,
  expectedName?: string,
) {
  const ready = preparePayout(msisdn, amount, telecomProviderId);
  const expected = String(expectedName || "").trim();
  const base = {
    name: "",
    local: ready.local,
    providerId: ready.providerId,
    providerName: ready.providerName,
    amount: ready.amount,
    lookedUp: false,
    match: false,
    customerReference: "",
  };
  const existing = nameDrafts.get(draftKey(ready.local, ready.amount, ready.providerId));
  if (existing?.name) {
    const match = !expected || namesMatch(expected, existing.name);
    return {
      ...base,
      name: existing.name,
      lookedUp: true,
      match,
      customerReference: existing.customerReference,
    };
  }
  if (!KEY()) {
    throw new Error("XentriPay is not configured");
  }

  const customerReference = payoutReference();
  try {
    const sent = await initiatePayout({
      customerReference,
      telecomProviderId: ready.providerId,
      msisdn: ready.local,
      name: expected || "Recipient",
      amount: ready.amount,
    });
    const registered = String(sent.validatedAccountName || pickName(sent) || "").trim();
    if (!registered) {
      throw new Error("XentriPay did not return a registered name for this number");
    }
    const match = !expected || namesMatch(expected, registered);
    const draft = storeNameDraft(ready, registered, {
      customerReference: sent.customerReference || customerReference,
      internalRef: sent.internalRef || null,
      status: sent.status || "PENDING",
      statusMessage: sent.statusMessage,
    });
    return {
      ...base,
      name: registered,
      lookedUp: true,
      match,
      customerReference: draft.customerReference,
    };
  } catch (err) {
    const hint = parseRegisteredNameHint((err as Error).message);
    if (!hint) throw err;
    const match = !expected || namesMatch(expected, hint);
    storeNameDraft(ready, hint);
    return {
      ...base,
      name: hint,
      lookedUp: true,
      match,
      customerReference: "",
    };
  }
}

export async function initiatePayout(body: Record<string, unknown>) {
  return xp<{
    id?: number;
    customerReference?: string;
    status?: string;
    statusMessage?: string;
    internalRef?: string;
    telecomProvider?: string;
    validatedAccountName?: string;
    amount?: number;
  }>("/api/payment-requests", {
    method: "POST",
    body: JSON.stringify({
      ...body,
      transactionType: "PAYOUT",
      currency: "RWF",
      amount: Math.round(Number(body.amount)),
    }),
  });
}

export async function payoutStatus(customerReference: string) {
  return xp<{
    timestamp?: string;
    message?: string;
    data?: { status?: string; reference_number?: string; amount?: string };
    status?: string;
  }>(`/api/payment-requests/check-status?customerRef=${encodeURIComponent(customerReference)}`);
}

function paidLike(status?: string) {
  const s = String(status || "").toUpperCase();
  return s === "SUCCESS" || s === "SUCCESSFUL" || s === "COMPLETED" || s === "PAID";
}

function failedLike(status?: string) {
  const s = String(status || "").toUpperCase();
  return s === "FAILED" || s === "REVERSED";
}

export async function markOrderPayment(orderId: number, status: string) {
  const order = await one<{ id: number; paymentStatus: string }>("SELECT * FROM orders WHERE id = ?", [orderId]);
  if (!order) return;
  if (paidLike(status) && order.paymentStatus !== "PAID") {
    await run("UPDATE orders SET paymentStatus = 'PAID' WHERE id = ?", [order.id]);
    notifyOrderPaidSafe(order.id);
  } else if (failedLike(status) && order.paymentStatus !== "PAID") {
    await run("UPDATE orders SET paymentStatus = 'FAILED' WHERE id = ?", [order.id]);
  }
}

async function findOrderByRef(ref: string) {
  if (!ref) return undefined;
  return one<{ id: number; paymentStatus: string }>(
    `SELECT * FROM orders WHERE paymentRef = ? OR checkoutSessionId = ? OR orderNumber = ? OR paymentTid = ? LIMIT 1`,
    [ref, ref, ref, ref],
  );
}

export async function applyCollectionRef(reference: string, status: string) {
  const order = await findOrderByRef(reference);
  if (order) await markOrderPayment(order.id, status);
}

export async function completeVendorPayout(payoutId: number, xentriStatus: string, note?: string) {
  const payout = await one<{
    id: number;
    vendorId: number | null;
    ownerType?: string;
    amount: number;
    status: string;
  }>("SELECT * FROM payout_requests WHERE id = ?", [payoutId]);
  if (!payout) return;
  if (paidLike(xentriStatus)) {
    if (payout.status === "PAID") return;
    await run("UPDATE payout_requests SET status = 'PAID', xentriStatus = ?, adminNote = COALESCE(?, adminNote) WHERE id = ?", [
      xentriStatus,
      note || "Paid via XentriPay",
      payout.id,
    ]);
    const ownerType = payout.ownerType === "platform" || !payout.vendorId ? "platform" : "vendor";
    const ownerId = ownerType === "platform" ? 0 : payout.vendorId;
    await run(
      `INSERT INTO wallet_transactions(ownerType, ownerId, \`type\`, amount, note, createdAt)
       VALUES(?, ?, 'PAYOUT', ?, ?, ?)`,
      [ownerType, ownerId, payout.amount, `Payout #${payout.id} via XentriPay`, now()],
    );
    return;
  }
  if (failedLike(xentriStatus) && payout.status !== "PAID") {
    await run("UPDATE payout_requests SET status = ?, xentriStatus = ?, adminNote = COALESCE(?, adminNote) WHERE id = ?", [
      xentriStatus.toUpperCase() === "REVERSED" ? "REVERSED" : "FAILED",
      xentriStatus,
      note || xentriStatus,
      payout.id,
    ]);
    return;
  }
  if (payout.status !== "PAID" && payout.status !== "REJECTED") {
    await run("UPDATE payout_requests SET xentriStatus = ?, adminNote = COALESCE(?, adminNote) WHERE id = ?", [
      xentriStatus || "PENDING",
      note || "Waiting for OTP confirmation, then the provider to complete the payout.",
      payout.id,
    ]);
  }
}

async function findPayoutByRef(ref: string) {
  if (!ref) return undefined;
  const byRef = await one<{ id: number }>(
    "SELECT id FROM payout_requests WHERE customerReference = ? OR internalRef = ? LIMIT 1",
    [ref, ref],
  );
  if (byRef) return byRef;
  const match = /^PAYOUT-(\d+)$/i.exec(ref);
  if (match) return one<{ id: number }>("SELECT id FROM payout_requests WHERE id = ?", [Number(match[1])]);
  return undefined;
}

export async function refreshOrderPayment(order: {
  id: number;
  paymentStatus: string;
  paymentMethod: string;
  paymentRef: string | null;
  checkoutSessionId: string | null;
}) {
  if (order.paymentStatus === "PAID" || order.paymentMethod === "COD") {
    return order.paymentStatus;
  }
  const ref = order.paymentRef || order.checkoutSessionId;
  if (!ref || !KEY()) return order.paymentStatus;
  try {
    if (order.paymentMethod === "CARD" && order.paymentRef) {
      try {
        const chk = await checkoutStatus(order.paymentRef);
        if (chk.status) {
          await markOrderPayment(order.id, chk.status);
          const updated = await one<{ paymentStatus: string }>("SELECT paymentStatus FROM orders WHERE id = ?", [
            order.id,
          ]);
          return updated?.paymentStatus || order.paymentStatus;
        }
      } catch {
        /* fall through to collection status */
      }
    }
    const col = await collectionStatus(ref);
    if (col.status) await markOrderPayment(order.id, col.status);
  } catch {
    /* still pending at the provider */
  }
  const updated = await one<{ paymentStatus: string }>("SELECT paymentStatus FROM orders WHERE id = ?", [order.id]);
  return updated?.paymentStatus || order.paymentStatus;
}

export async function refreshPayout(payout: { id: number; customerReference: string | null; status: string }) {
  if (payout.status === "PAID" || payout.status === "REJECTED" || !payout.customerReference || !KEY()) {
    return { status: payout.status, xentriStatus: payout.status, message: "" };
  }
  let xentriStatus = "";
  let message = "";
  try {
    const res = await payoutStatus(payout.customerReference);
    xentriStatus = String(res.data?.status || res.status || "");
    message = String(res.message || "");
    if (xentriStatus) await completeVendorPayout(payout.id, xentriStatus, message);
  } catch (err) {
    message = (err as Error).message || "Still waiting for OTP or the provider";
  }
  const updated = await one<{ status: string; xentriStatus: string | null; adminNote: string | null }>(
    "SELECT status, xentriStatus, adminNote FROM payout_requests WHERE id = ?",
    [payout.id],
  );
  return {
    status: updated?.status || payout.status,
    xentriStatus: updated?.xentriStatus || xentriStatus,
    message: updated?.adminNote || message,
  };
}

export async function processWebhookEvent(payload: {
  event?: string;
  data?: Record<string, unknown>;
  idempotencyKey?: string;
}) {
  const event = String(payload.event || "").toUpperCase();
  const data = payload.data || {};
  const refs = [
    data.reference,
    data.customerRef,
    data.customerReference,
    data.refid,
    data.rid,
    data.id,
  ]
    .map((v) => String(v || "").trim())
    .filter(Boolean);

  if (event.includes("COLLECTION") || event.includes("CHECKOUT")) {
    const status = event.includes("SUCCESS")
      ? "SUCCESS"
      : event.includes("FAIL")
        ? "FAILED"
        : String(data.status || "");
    for (const ref of refs) await applyCollectionRef(ref, status || String(data.status || ""));
    return;
  }

  if (event.includes("PAYOUT") || event.includes("PAYMENTREQUEST") || event.includes("PAYMENT_REQUEST")) {
    const status = event.includes("SUCCESS") || event.includes("COMPLETED")
      ? "SUCCESSFUL"
      : event.includes("FAIL")
        ? "FAILED"
        : event.includes("REVERS")
          ? "REVERSED"
          : event.includes("OTP") || event.includes("CREATED") || event.includes("CONFIRMED")
            ? "PENDING"
            : String(data.status || "PENDING");
    for (const ref of refs) {
      const payout = await findPayoutByRef(ref);
      if (payout) await completeVendorPayout(payout.id, status);
    }
  }
}
