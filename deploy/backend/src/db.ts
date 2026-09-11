import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const uploadsDir = path.join(root, "uploads");
mkdirSync(uploadsDir, { recursive: true });

function loadDotEnv() {
  try {
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
    /* no .env file */
  }
}

loadDotEnv();

const MYSQL_HOST = process.env.MYSQL_HOST || "127.0.0.1";
const MYSQL_PORT = Number(process.env.MYSQL_PORT || 3306);
const MYSQL_USER = process.env.MYSQL_USER || "root";
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || "";
const MYSQL_DATABASE = process.env.MYSQL_DATABASE || "kigali_taste";

export let pool: mysql.Pool;

type KtGlobal = typeof globalThis & { __kigaliTastePool?: mysql.Pool };

function getPool(): mysql.Pool {
  const g = globalThis as KtGlobal;
  const p = pool ?? g.__kigaliTastePool;
  if (!p) {
    throw new Error(
      "Database pool is not initialized. Check MySQL credentials in .env and restart the app.",
    );
  }
  return p;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  role VARCHAR(16) NOT NULL,
  firstName VARCHAR(80) NOT NULL,
  lastName VARCHAR(80) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  phone VARCHAR(40) NOT NULL,
  passwordHash VARCHAR(120) NOT NULL,
  emailVerified TINYINT NOT NULL DEFAULT 0,
  createdAt VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS vendors (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL UNIQUE,
  businessName VARCHAR(160) NOT NULL,
  businessAddress VARCHAR(255) NOT NULL,
  businessType VARCHAR(40) NOT NULL,
  nationalIdUrl TEXT NOT NULL,
  rdbCertificateUrl TEXT NOT NULL,
  status VARCHAR(32) NOT NULL,
  rejectionReason TEXT,
  suspended TINYINT NOT NULL DEFAULT 0,
  FOREIGN KEY (userId) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS restaurants (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  vendorId INT NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  slug VARCHAR(180) NOT NULL UNIQUE,
  logoUrl TEXT,
  coverUrl TEXT,
  description TEXT,
  address VARCHAR(255) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  \`type\` VARCHAR(40) NOT NULL,
  isLive TINYINT NOT NULL DEFAULT 0,
  isOpen TINYINT NOT NULL DEFAULT 1,
  openingHours VARCHAR(80),
  FOREIGN KEY (vendorId) REFERENCES vendors(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS categories (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  restaurantId INT NOT NULL,
  name VARCHAR(80) NOT NULL,
  sort INT NOT NULL DEFAULT 0,
  FOREIGN KEY (restaurantId) REFERENCES restaurants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS menu_items (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  restaurantId INT NOT NULL,
  categoryId INT NOT NULL,
  name VARCHAR(160) NOT NULL,
  description TEXT,
  imageUrl TEXT,
  basePrice INT NOT NULL,
  adminMarkup INT NOT NULL DEFAULT 0,
  isAvailable TINYINT NOT NULL DEFAULT 1,
  FOREIGN KEY (restaurantId) REFERENCES restaurants(id),
  FOREIGN KEY (categoryId) REFERENCES categories(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS orders (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  orderNumber VARCHAR(32) NOT NULL UNIQUE,
  customerId INT NOT NULL,
  restaurantId INT NOT NULL,
  status VARCHAR(32) NOT NULL,
  paymentMethod VARCHAR(16) NOT NULL,
  paymentStatus VARCHAR(16) NOT NULL,
  deliveryFee INT NOT NULL,
  vendorAmount INT NOT NULL,
  platformAmount INT NOT NULL,
  deliveryAddress VARCHAR(255) NOT NULL,
  customerPhone VARCHAR(40) NOT NULL,
  customerName VARCHAR(160) NOT NULL,
  notes TEXT,
  deliveryNote TEXT,
  rating INT,
  walletsCredited TINYINT NOT NULL DEFAULT 0,
  createdAt VARCHAR(40) NOT NULL,
  FOREIGN KEY (customerId) REFERENCES users(id),
  FOREIGN KEY (restaurantId) REFERENCES restaurants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS order_items (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  orderId INT NOT NULL,
  menuItemId INT,
  nameSnapshot VARCHAR(160) NOT NULL,
  basePriceSnapshot INT NOT NULL,
  markupSnapshot INT NOT NULL,
  qty INT NOT NULL,
  FOREIGN KEY (orderId) REFERENCES orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ownerType VARCHAR(16) NOT NULL,
  ownerId INT NOT NULL,
  \`type\` VARCHAR(16) NOT NULL,
  amount INT NOT NULL,
  orderId INT,
  note TEXT,
  createdAt VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS payout_requests (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  vendorId INT NULL,
  ownerType VARCHAR(16) NOT NULL DEFAULT 'vendor',
  amount INT NOT NULL,
  methodNote VARCHAR(255) NOT NULL,
  status VARCHAR(24) NOT NULL,
  adminNote TEXT,
  msisdn VARCHAR(20),
  recipientName VARCHAR(160),
  telecomProviderId VARCHAR(16),
  customerReference VARCHAR(80),
  xentriStatus VARCHAR(40),
  internalRef VARCHAR(80),
  createdAt VARCHAR(40) NOT NULL,
  FOREIGN KEY (vendorId) REFERENCES vendors(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS webhook_events (
  idempotencyKey VARCHAR(190) NOT NULL PRIMARY KEY,
  event VARCHAR(80) NOT NULL,
  createdAt VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS mailbox_messages (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  folder VARCHAR(16) NOT NULL,
  fromEmail VARCHAR(190) NOT NULL,
  fromName VARCHAR(160) NOT NULL,
  toUserId INT,
  toEmail VARCHAR(190),
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  isRead TINYINT NOT NULL DEFAULT 0,
  parentId INT,
  createdAt VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS mailbox_attachments (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  messageId INT NOT NULL,
  filename VARCHAR(255) NOT NULL,
  storedName VARCHAR(120) NOT NULL,
  mimeType VARCHAR(120) NOT NULL,
  size INT NOT NULL DEFAULT 0,
  createdAt VARCHAR(40) NOT NULL,
  KEY mailbox_attachments_message (messageId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS settings (
  setting_key VARCHAR(64) NOT NULL PRIMARY KEY,
  value TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS delivery_zones (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  keywords TEXT NOT NULL,
  fee INT NOT NULL,
  sort INT NOT NULL DEFAULT 0,
  isActive TINYINT NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS email_verifications (
  email VARCHAR(190) NOT NULL PRIMARY KEY,
  code VARCHAR(8) NOT NULL,
  expiresAt VARCHAR(40) NOT NULL,
  purpose VARCHAR(32) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL,
  subscribedAt VARCHAR(40) NOT NULL,
  source VARCHAR(40) NOT NULL DEFAULT 'homepage',
  UNIQUE KEY newsletter_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

export async function initDb() {
  const bootstrap = await mysql.createConnection({
    host: MYSQL_HOST,
    port: MYSQL_PORT,
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
    multipleStatements: true,
  });
  await bootstrap.query(
    `CREATE DATABASE IF NOT EXISTS \`${MYSQL_DATABASE}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await bootstrap.end();

  pool = mysql.createPool({
    host: MYSQL_HOST,
    port: MYSQL_PORT,
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
    database: MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
  });
  (globalThis as KtGlobal).__kigaliTastePool = pool;

  const conn = await getPool().getConnection();
  try {
    for (const stmt of SCHEMA.split(";")
      .map((s) => s.trim())
      .filter(Boolean)) {
      await conn.query(stmt);
    }
  } finally {
    conn.release();
  }
  await seedIfEmpty();
  await migratePayments();
  await migrateMailbox();
  await migrateUsers();
  await migrateReviews();
  await migratePromos();
  await migrateDishPromos();
  const { seedHeroSettingsIfMissing } = await import("./heroDefaults.ts");
  await seedHeroSettingsIfMissing(
    (key) => setting(key),
    (key, value) => setSetting(key, value),
  );
  const { seedAboutSettingsIfMissing } = await import("./aboutDefaults.ts");
  await seedAboutSettingsIfMissing(
    (key) => setting(key),
    (key, value) => setSetting(key, value),
  );
  const { seedNewsletterSettingsIfMissing } = await import("./newsletterDefaults.ts");
  await seedNewsletterSettingsIfMissing(
    (key) => setting(key),
    (key, value) => setSetting(key, value),
  );
  const { seedFaqSettingsIfMissing } = await import("./faqDefaults.ts");
  await seedFaqSettingsIfMissing(
    (key) => setting(key),
    (key, value) => setSetting(key, value),
  );
  const { seedShippingSettingsIfMissing } = await import("./shippingDefaults.ts");
  await seedShippingSettingsIfMissing(
    (key) => setting(key),
    (key, value) => setSetting(key, value),
  );
  const { seedDeliveryZonesIfEmpty } = await import("./deliveryZones.ts");
  await seedDeliveryZonesIfEmpty();
  console.log(
    `MySQL connected  ${MYSQL_USER}@${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DATABASE}`,
  );
}

async function columnExists(table: string, column: string) {
  const rows = await many<{ Field: string }>(
    `SELECT COLUMN_NAME AS Field FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  return rows.length > 0;
}

async function addColumn(table: string, column: string, ddl: string) {
  if (await columnExists(table, column)) return;
  try {
    await run(`ALTER TABLE \`${table}\` ADD COLUMN ${ddl}`);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code !== "ER_DUP_FIELDNAME") throw err;
  }
}

async function migratePayments() {
  await addColumn("orders", "paymentRef", "paymentRef VARCHAR(80) NULL");
  await addColumn("orders", "paymentTid", "paymentTid VARCHAR(80) NULL");
  await addColumn("orders", "checkoutSessionId", "checkoutSessionId VARCHAR(80) NULL");
  await addColumn("orders", "paymentUrl", "paymentUrl TEXT NULL");
  await addColumn("payout_requests", "msisdn", "msisdn VARCHAR(20) NULL");
  await addColumn("payout_requests", "recipientName", "recipientName VARCHAR(160) NULL");
  await addColumn("payout_requests", "telecomProviderId", "telecomProviderId VARCHAR(16) NULL");
  await addColumn("payout_requests", "customerReference", "customerReference VARCHAR(80) NULL");
  await addColumn("payout_requests", "xentriStatus", "xentriStatus VARCHAR(40) NULL");
  await addColumn("payout_requests", "internalRef", "internalRef VARCHAR(80) NULL");
  await addColumn("payout_requests", "ownerType", "ownerType VARCHAR(16) NOT NULL DEFAULT 'vendor'");
  try {
    await run("ALTER TABLE payout_requests MODIFY vendorId INT NULL");
  } catch {
    /* already nullable */
  }
  await addColumn("orders", "fulfillment", "fulfillment VARCHAR(16) NOT NULL DEFAULT 'DELIVERY'");
  await addColumn("orders", "deliveryLat", "deliveryLat DECIMAL(10,7) NULL");
  await addColumn("orders", "deliveryLng", "deliveryLng DECIMAL(10,7) NULL");
  await addColumn("orders", "riderLat", "riderLat DECIMAL(10,7) NULL");
  await addColumn("orders", "riderLng", "riderLng DECIMAL(10,7) NULL");
  await addColumn("orders", "riderLocationAt", "riderLocationAt VARCHAR(40) NULL");
  await addColumn("orders", "deliveryZoneId", "deliveryZoneId INT NULL");
  await addColumn("orders", "deliveryZoneName", "deliveryZoneName VARCHAR(80) NULL");
}

async function migrateMailbox() {
  await addColumn("mailbox_messages", "externalId", "externalId VARCHAR(255) NULL");
  try {
    await run("CREATE UNIQUE INDEX mailbox_external_id ON mailbox_messages (externalId)");
  } catch {
    /* index may already exist */
  }
  try {
    await run(`CREATE TABLE IF NOT EXISTS mailbox_attachments (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      messageId INT NOT NULL,
      filename VARCHAR(255) NOT NULL,
      storedName VARCHAR(120) NOT NULL,
      mimeType VARCHAR(120) NOT NULL,
      size INT NOT NULL DEFAULT 0,
      createdAt VARCHAR(40) NOT NULL,
      KEY mailbox_attachments_message (messageId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  } catch {
    /* table may already exist */
  }
}

async function migrateUsers() {
  await addColumn("users", "avatarUrl", "avatarUrl TEXT NULL");
}

async function migrateReviews() {
  await addColumn("orders", "reviewComment", "reviewComment TEXT NULL");
  await addColumn("orders", "reviewedAt", "reviewedAt VARCHAR(40) NULL");
  await addColumn("orders", "reviewVisible", "reviewVisible TINYINT NOT NULL DEFAULT 1");
}

async function migratePromos() {
  await addColumn("orders", "promoCode", "promoCode VARCHAR(40) NULL");
  await addColumn("orders", "discountAmount", "discountAmount INT NOT NULL DEFAULT 0");
  const { ensurePromoTables } = await import("./promoCodes.ts");
  await ensurePromoTables();
}

async function migrateDishPromos() {
  await addColumn("menu_items", "promoActive", "promoActive TINYINT NOT NULL DEFAULT 0");
  await addColumn("menu_items", "promoType", "promoType VARCHAR(16) NULL");
  await addColumn("menu_items", "promoBuyQty", "promoBuyQty INT NOT NULL DEFAULT 1");
  await addColumn("menu_items", "promoGetQty", "promoGetQty INT NOT NULL DEFAULT 1");
  await addColumn("menu_items", "promoGetIds", "promoGetIds TEXT NULL");
  await addColumn("order_items", "isFree", "isFree TINYINT NOT NULL DEFAULT 0");
  await addColumn("order_items", "promoTriggerMenuItemId", "promoTriggerMenuItemId INT NULL");
}

export async function many<T>(sql: string, params: mysql.ExecuteValues[] = []): Promise<T[]> {
  const [rows] = await getPool().execute(sql, params);
  return rows as T[];
}

export async function one<T>(
  sql: string,
  params: mysql.ExecuteValues[] = [],
): Promise<T | undefined> {
  const rows = await many<T>(sql, params);
  return rows[0];
}

export async function count(sql: string, params: mysql.ExecuteValues[] = []) {
  const row = await one<{ n: number }>(sql, params);
  return Number(row?.n ?? 0);
}

export async function run(sql: string, params: mysql.ExecuteValues[] = []) {
  const [result] = await getPool().execute(sql, params);
  const header = result as mysql.ResultSetHeader;
  return {
    lastInsertRowid: header.insertId,
    changes: header.affectedRows,
  };
}

export function now() {
  return new Date().toISOString();
}

export function slugify(text: string) {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "shop"
  );
}

export async function uniqueSlug(base: string) {
  let slug = slugify(base);
  let n = 1;
  while (await one("SELECT id FROM restaurants WHERE slug = ?", [slug])) {
    slug = `${slugify(base)}-${n++}`;
  }
  return slug;
}

export async function setting(key: string, fallback = "") {
  const row = await one<{ value: string }>(
    "SELECT value FROM settings WHERE setting_key = ?",
    [key],
  );
  return row?.value ?? fallback;
}

export async function setSetting(key: string, value: string) {
  await run(
    "INSERT INTO settings(setting_key, value) VALUES(?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)",
    [key, value],
  );
}

export async function walletBalance(ownerType: string, ownerId: number) {
  const row = await one<{ total: number }>(
    `SELECT COALESCE(SUM(CASE WHEN \`type\` = 'EARNING' THEN amount
      WHEN \`type\` IN ('PAYOUT','WITHDRAWAL') THEN -amount ELSE 0 END), 0) AS total
     FROM wallet_transactions WHERE ownerType = ? AND ownerId = ?`,
    [ownerType, ownerId],
  );
  return Number(row?.total ?? 0);
}

export async function pendingPayouts(vendorId: number) {
  const row = await one<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM payout_requests
     WHERE vendorId = ? AND ownerType = 'vendor' AND status IN ('REQUESTED','SENDING')`,
    [vendorId],
  );
  return Number(row?.total ?? 0);
}

export async function pendingPayoutsAll() {
  const row = await one<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM payout_requests
     WHERE status IN ('REQUESTED','SENDING') AND ownerType = 'vendor'`,
  );
  return Number(row?.total ?? 0);
}

export async function pendingPlatformPayouts() {
  const row = await one<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM payout_requests
     WHERE status IN ('REQUESTED','SENDING') AND ownerType = 'platform'`,
  );
  return Number(row?.total ?? 0);
}

export async function platformCommission() {
  const row = await one<{ markup: number; delivery: number }>(
    `SELECT COALESCE(SUM(GREATEST(platformAmount - deliveryFee, 0)), 0) AS markup,
            COALESCE(SUM(deliveryFee), 0) AS delivery
     FROM orders WHERE paymentStatus = 'PAID' AND walletsCredited = 1`,
  );
  return {
    markupEarned: Number(row?.markup ?? 0),
    deliveryEarned: Number(row?.delivery ?? 0),
  };
}

export async function walletStats(ownerType: string, ownerId: number) {
  const rows = await many<{ type: string; amount: number; orderStatus: string | null }>(
    `SELECT wt.type, wt.amount, o.status AS orderStatus
     FROM wallet_transactions wt
     LEFT JOIN orders o ON o.id = wt.orderId
     WHERE wt.ownerType = ? AND wt.ownerId = ?`,
    [ownerType, ownerId],
  );
  let collected = 0;
  let paidOut = 0;
  for (const row of rows) {
    const amount = Number(row.amount) || 0;
    if (row.type === "EARNING") {
      if (!row.orderStatus || row.orderStatus === "DELIVERED") collected += amount;
    }
    if (row.type === "PAYOUT" || row.type === "WITHDRAWAL") paidOut += amount;
  }
  const balance = collected - paidOut;
  const held = ownerType === "vendor" ? await pendingPayouts(ownerId) : await pendingPlatformPayouts();
  return {
    collected,
    paidOut,
    held,
    balance,
    available: Math.max(0, balance - held),
  };
}

export async function pendingVendorEarnings(vendorId: number) {
  const row = await one<{ total: number }>(
    `SELECT COALESCE(SUM(o.vendorAmount), 0) AS total
     FROM orders o JOIN restaurants r ON r.id = o.restaurantId
     WHERE r.vendorId = ? AND o.paymentStatus = 'PAID'
     AND o.status NOT IN ('DELIVERED', 'CANCELLED')`,
    [vendorId],
  );
  return Number(row?.total ?? 0);
}

export async function pendingPlatformEarnings() {
  const row = await one<{ total: number; markup: number; delivery: number }>(
    `SELECT COALESCE(SUM(platformAmount), 0) AS total,
            COALESCE(SUM(GREATEST(platformAmount - deliveryFee, 0)), 0) AS markup,
            COALESCE(SUM(deliveryFee), 0) AS delivery
     FROM orders WHERE paymentStatus = 'PAID'
     AND status NOT IN ('DELIVERED', 'CANCELLED')`,
  );
  return {
    total: Number(row?.total ?? 0),
    markup: Number(row?.markup ?? 0),
    delivery: Number(row?.delivery ?? 0),
  };
}

export type TxFeedItem = {
  id: string;
  kind: "earning" | "payout" | "withdrawal" | "pending" | "payout_request";
  direction: "in" | "out" | "pending";
  amount: number;
  title: string;
  detail: string;
  status?: string;
  orderNumber?: string;
  restaurantName?: string;
  vendorName?: string;
  createdAt: string;
};

function txSort(items: TxFeedItem[]) {
  return items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function vendorTransactionFeed(vendorId: number, shopName: string) {
  const items: TxFeedItem[] = [];
  const walletRows = await many<{
    id: number;
    type: string;
    amount: number;
    note: string | null;
    createdAt: string;
    orderNumber: string | null;
  }>(
    `SELECT wt.id, wt.type, wt.amount, wt.note, wt.createdAt, o.orderNumber
     FROM wallet_transactions wt
     LEFT JOIN orders o ON o.id = wt.orderId
     WHERE wt.ownerType = 'vendor' AND wt.ownerId = ?
     AND (wt.type != 'EARNING' OR o.status = 'DELIVERED' OR o.id IS NULL)
     ORDER BY wt.id DESC`,
    [vendorId],
  );
  for (const row of walletRows) {
    const earning = row.type === "EARNING";
    items.push({
      id: `wt-${row.id}`,
      kind: earning ? "earning" : row.type === "WITHDRAWAL" ? "withdrawal" : "payout",
      direction: earning ? "in" : "out",
      amount: row.amount,
      title: earning ? "Paid to you" : row.type === "PAYOUT" ? "Payout sent" : "Withdrawal",
      detail: row.note || (earning ? "Menu price credited after delivery" : "Mobile Money payout"),
      orderNumber: row.orderNumber || undefined,
      restaurantName: shopName,
      createdAt: row.createdAt,
    });
  }

  const payouts = await many<{
    id: number;
    amount: number;
    status: string;
    xentriStatus: string | null;
    recipientName: string | null;
    msisdn: string | null;
    methodNote: string;
    createdAt: string;
  }>(
    `SELECT id, amount, status, xentriStatus, recipientName, msisdn, methodNote, createdAt
     FROM payout_requests
     WHERE vendorId = ? AND ownerType = 'vendor' AND status != 'PAID'
     ORDER BY id DESC`,
    [vendorId],
  );
  for (const row of payouts) {
    items.push({
      id: `payout-${row.id}`,
      kind: "payout_request",
      direction: "out",
      amount: row.amount,
      title: "Payout in progress",
      detail: `${row.recipientName || "MoMo recipient"} · ${row.msisdn || row.methodNote}`,
      status: String(row.xentriStatus || row.status || "PENDING").toUpperCase(),
      restaurantName: shopName,
      createdAt: row.createdAt,
    });
  }

  const pendingOrders = await many<{
    orderNumber: string;
    vendorAmount: number;
    platformAmount: number;
    status: string;
    createdAt: string;
  }>(
    `SELECT o.orderNumber, o.vendorAmount, o.platformAmount, o.status, o.createdAt
     FROM orders o JOIN restaurants r ON r.id = o.restaurantId
     WHERE r.vendorId = ? AND o.paymentStatus = 'PAID'
     AND o.status NOT IN ('DELIVERED', 'CANCELLED')
     ORDER BY o.id DESC`,
    [vendorId],
  );
  for (const row of pendingOrders) {
    const customerTotal = row.vendorAmount + row.platformAmount;
    items.push({
      id: `pending-${row.orderNumber}`,
      kind: "pending",
      direction: "pending",
      amount: row.vendorAmount,
      title: "Pending menu earning",
      detail: `${row.orderNumber} · customer paid ${customerTotal.toLocaleString("en-RW")} FRw · ${row.status.replace(/_/g, " ").toLowerCase()}`,
      orderNumber: row.orderNumber,
      status: row.status,
      restaurantName: shopName,
      createdAt: row.createdAt,
    });
  }

  return txSort(items);
}

export async function platformTransactionFeed() {
  const items: TxFeedItem[] = [];
  const walletRows = await many<{
    id: number;
    type: string;
    amount: number;
    note: string | null;
    createdAt: string;
    orderNumber: string | null;
    restaurantName: string | null;
  }>(
    `SELECT wt.id, wt.type, wt.amount, wt.note, wt.createdAt, o.orderNumber, r.name AS restaurantName
     FROM wallet_transactions wt
     LEFT JOIN orders o ON o.id = wt.orderId
     LEFT JOIN restaurants r ON r.id = o.restaurantId
     WHERE wt.ownerType = 'platform'
     AND (wt.type != 'EARNING' OR o.status = 'DELIVERED' OR o.id IS NULL)
     ORDER BY wt.id DESC`,
  );
  for (const row of walletRows) {
    const earning = row.type === "EARNING";
    items.push({
      id: `wt-${row.id}`,
      kind: earning ? "earning" : row.type === "WITHDRAWAL" ? "withdrawal" : "payout",
      direction: earning ? "in" : "out",
      amount: row.amount,
      title: earning ? "Markup & delivery" : row.type === "PAYOUT" ? "Commission payout" : "Cash withdrawal",
      detail: row.note || (earning ? "Order delivered" : "Platform payout"),
      orderNumber: row.orderNumber || undefined,
      restaurantName: row.restaurantName || undefined,
      createdAt: row.createdAt,
    });
  }

  const payouts = await many<{
    id: number;
    amount: number;
    status: string;
    xentriStatus: string | null;
    ownerType: string;
    recipientName: string | null;
    msisdn: string | null;
    methodNote: string;
    businessName: string | null;
    createdAt: string;
  }>(
    `SELECT p.id, p.amount, p.status, p.xentriStatus, p.ownerType, p.recipientName, p.msisdn, p.methodNote, p.createdAt,
            v.businessName
     FROM payout_requests p
     LEFT JOIN vendors v ON v.id = p.vendorId
     WHERE p.status != 'PAID'
     ORDER BY p.id DESC`,
  );
  for (const row of payouts) {
    const platform = row.ownerType === "platform";
    items.push({
      id: `payout-${row.id}`,
      kind: "payout_request",
      direction: "out",
      amount: row.amount,
      title: platform ? "Commission payout in progress" : "Vendor payout in progress",
      detail: platform
        ? `${row.recipientName || "MoMo"} · ${row.msisdn || row.methodNote}`
        : `${row.businessName || "Vendor"} · ${frwLabel(row.amount)} requested`,
      status: String(row.xentriStatus || row.status || "PENDING").toUpperCase(),
      vendorName: row.businessName || undefined,
      createdAt: row.createdAt,
    });
  }

  const pendingOrders = await many<{
    orderNumber: string;
    platformAmount: number;
    deliveryFee: number;
    vendorAmount: number;
    status: string;
    restaurantName: string;
    createdAt: string;
  }>(
    `SELECT o.orderNumber, o.platformAmount, o.deliveryFee, o.vendorAmount, o.status, o.createdAt, r.name AS restaurantName
     FROM orders o JOIN restaurants r ON r.id = o.restaurantId
     WHERE o.paymentStatus = 'PAID' AND o.status NOT IN ('DELIVERED', 'CANCELLED')
     ORDER BY o.id DESC`,
  );
  for (const row of pendingOrders) {
    const markup = row.platformAmount - row.deliveryFee;
    const customerTotal = row.vendorAmount + row.platformAmount;
    items.push({
      id: `pending-${row.orderNumber}`,
      kind: "pending",
      direction: "pending",
      amount: row.platformAmount,
      title: "Pending platform share",
      detail: `${row.orderNumber} · ${row.restaurantName} · markup ${markup.toLocaleString("en-RW")} + delivery ${row.deliveryFee.toLocaleString("en-RW")} FRw (customer paid ${customerTotal.toLocaleString("en-RW")} FRw)`,
      orderNumber: row.orderNumber,
      restaurantName: row.restaurantName,
      status: row.status,
      createdAt: row.createdAt,
    });
  }

  return txSort(items);
}

function frwLabel(amount: number) {
  return `${Math.round(amount).toLocaleString("en-RW")} FRw`;
}

export async function reconcileWalletCredits() {
  const bad = await many<{ id: number }>(
    `SELECT id FROM orders WHERE walletsCredited = 1 AND status != 'DELIVERED'`,
  );
  for (const order of bad) {
    await run(`DELETE FROM wallet_transactions WHERE orderId = ?`, [order.id]);
    await run(`UPDATE orders SET walletsCredited = 0 WHERE id = ?`, [order.id]);
  }
  return bad.length;
}

export async function syncDeliveredWalletCredits(opts?: { vendorId?: number }) {
  await reconcileWalletCredits();
  const rows = opts?.vendorId
    ? await many<{ id: number }>(
        `SELECT o.id FROM orders o JOIN restaurants r ON r.id = o.restaurantId
         WHERE r.vendorId = ? AND o.paymentStatus = 'PAID' AND o.status = 'DELIVERED' AND o.walletsCredited = 0`,
        [opts.vendorId],
      )
    : await many<{ id: number }>(
        `SELECT id FROM orders WHERE paymentStatus = 'PAID' AND status = 'DELIVERED' AND walletsCredited = 0`,
      );
  let credited = 0;
  for (const row of rows) {
    if (await creditWalletsIfNeeded(row.id)) credited++;
  }
  return credited;
}

export async function creditWalletsIfNeeded(orderId: number) {
  const order = await one<{
    id: number;
    restaurantId: number;
    vendorAmount: number;
    platformAmount: number;
    paymentStatus: string;
    status: string;
    walletsCredited: number;
    orderNumber: string;
    deliveryFee: number;
  }>("SELECT * FROM orders WHERE id = ?", [orderId]);
  if (
    !order ||
    order.walletsCredited ||
    order.paymentStatus !== "PAID" ||
    order.status !== "DELIVERED"
  ) {
    return false;
  }

  const restaurant = await one<{ vendorId: number }>(
    "SELECT vendorId FROM restaurants WHERE id = ?",
    [order.restaurantId],
  );
  if (!restaurant) return false;

  const customerTotal = order.vendorAmount + order.platformAmount;
  const markupPart = order.platformAmount - order.deliveryFee;
  await run(
    `INSERT INTO wallet_transactions(ownerType, ownerId, \`type\`, amount, orderId, note, createdAt)
     VALUES('vendor', ?, 'EARNING', ?, ?, ?, ?)`,
    [
      restaurant.vendorId,
      order.vendorAmount,
      order.id,
      `Menu ${order.vendorAmount} FRw from ${order.orderNumber} (customer paid ${customerTotal} FRw)`,
      now(),
    ],
  );
  await run(
    `INSERT INTO wallet_transactions(ownerType, ownerId, \`type\`, amount, orderId, note, createdAt)
     VALUES('platform', 0, 'EARNING', ?, ?, ?, ?)`,
    [
      order.platformAmount,
      order.id,
      `Markup ${markupPart} FRw + delivery ${order.deliveryFee} FRw from ${order.orderNumber}`,
      now(),
    ],
  );
  await run("UPDATE orders SET walletsCredited = 1 WHERE id = ?", [order.id]);
  return true;
}

export async function deleteOrderById(orderId: number) {
  await run("DELETE FROM wallet_transactions WHERE orderId = ?", [orderId]);
  await run("DELETE FROM order_items WHERE orderId = ?", [orderId]);
  await run("DELETE FROM orders WHERE id = ?", [orderId]);
}

export async function nextOrderNumber() {
  const prefix = await setting("orderPrefix", "KT");
  const n = await count("SELECT COUNT(*) AS n FROM orders");
  return `${prefix}-${String(n + 1).padStart(4, "0")}`;
}

export async function createCode(email: string, purpose: string) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  await run(
    `INSERT INTO email_verifications(email, code, expiresAt, purpose)
     VALUES(?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE code = VALUES(code), expiresAt = VALUES(expiresAt), purpose = VALUES(purpose)`,
    [email.toLowerCase(), code, expiresAt, purpose],
  );
  return code;
}

export async function consumeCode(email: string, code: string, purpose: string) {
  const row = await one<{ code: string; expiresAt: string; purpose: string }>(
    "SELECT code, expiresAt, purpose FROM email_verifications WHERE email = ?",
    [email.toLowerCase()],
  );
  if (!row || row.code !== code || row.purpose !== purpose) return false;
  if (new Date(row.expiresAt).getTime() < Date.now()) return false;
  await run("DELETE FROM email_verifications WHERE email = ?", [email.toLowerCase()]);
  return true;
}

export async function seedIfEmpty() {
  if ((await count("SELECT COUNT(*) AS n FROM users")) > 0) return;

  const adminHash = bcrypt.hashSync("admin123", 10);
  const vendorHash = bcrypt.hashSync("vendor123", 10);
  const customerHash = bcrypt.hashSync("customer123", 10);
  const pendingHash = bcrypt.hashSync("pending123", 10);
  const t = now();

  await run(
    `INSERT INTO users(role, firstName, lastName, email, phone, passwordHash, emailVerified, createdAt)
     VALUES('admin','Kigali','Taste','admin@kigalitaste.rw','+250 780 000 000', ?, 1, ?)`,
    [adminHash, t],
  );
  const vendorUser = await run(
    `INSERT INTO users(role, firstName, lastName, email, phone, passwordHash, emailVerified, createdAt)
     VALUES('vendor','Jean','Mugisha','vendor@kigalitaste.rw','+250 788 111 111', ?, 1, ?)`,
    [vendorHash, t],
  );
  await run(
    `INSERT INTO users(role, firstName, lastName, email, phone, passwordHash, emailVerified, createdAt)
     VALUES('customer','Aline','Uwase','customer@kigalitaste.rw','+250 788 222 222', ?, 1, ?)`,
    [customerHash, t],
  );
  const pendingUser = await run(
    `INSERT INTO users(role, firstName, lastName, email, phone, passwordHash, emailVerified, createdAt)
     VALUES('vendor','Claudine','Iradukunda','pending@kigalitaste.rw','+250 788 333 333', ?, 1, ?)`,
    [pendingHash, t],
  );

  const vendor = await run(
    `INSERT INTO vendors(userId, businessName, businessAddress, businessType, nationalIdUrl, rdbCertificateUrl, status)
     VALUES(?, 'Kigali Brochettes House', 'KN 5 Rd, Kacyiru, Kigali', 'Restaurant',
     'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=800&q=80',
     'APPROVED')`,
    [Number(vendorUser.lastInsertRowid)],
  );

  await run(
    `INSERT INTO vendors(userId, businessName, businessAddress, businessType, nationalIdUrl, rdbCertificateUrl, status)
     VALUES(?, 'Nyamirambo Bakery', 'KN 2 Ave, Nyamirambo, Kigali', 'Bakery',
     'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=800&q=80',
     'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=800&q=80',
     'PENDING_APPROVAL')`,
    [Number(pendingUser.lastInsertRowid)],
  );

  const restaurant = await run(
    `INSERT INTO restaurants(vendorId, name, slug, logoUrl, coverUrl, description, address, phone, \`type\`, isLive, isOpen, openingHours)
     VALUES(?, 'Kigali Brochettes House', 'kigali-brochettes-house',
     'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=200&q=80',
     'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1400&q=80',
     'Grilled brochettes, chips and cold drinks from Kacyiru.',
     'KN 5 Rd, Kacyiru, Kigali', '+250 788 111 111', 'Restaurant', 1, 1, '10:00 – 22:00')`,
    [Number(vendor.lastInsertRowid)],
  );
  const rid = Number(restaurant.lastInsertRowid);

  const mains = await run(
    "INSERT INTO categories(restaurantId, name, sort) VALUES(?, 'Mains', 1)",
    [rid],
  );
  const sides = await run(
    "INSERT INTO categories(restaurantId, name, sort) VALUES(?, 'Sides & drinks', 2)",
    [rid],
  );
  const mainsId = Number(mains.lastInsertRowid);
  const sidesId = Number(sides.lastInsertRowid);

  await run(
    `INSERT INTO menu_items(restaurantId, categoryId, name, description, imageUrl, basePrice, adminMarkup, isAvailable)
     VALUES(?, ?, 'Brochette', 'Grilled goat brochette with pili pili',
     'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80', 8000, 1500, 1)`,
    [rid, mainsId],
  );
  await run(
    `INSERT INTO menu_items(restaurantId, categoryId, name, description, imageUrl, basePrice, adminMarkup, isAvailable)
     VALUES(?, ?, 'Pizza', 'Wood-fired pizza — vendor 10,000 FRw, admin markup 2,000 FRw',
     'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80', 10000, 2000, 1)`,
    [rid, mainsId],
  );
  await run(
    `INSERT INTO menu_items(restaurantId, categoryId, name, description, imageUrl, basePrice, adminMarkup, isAvailable)
     VALUES(?, ?, 'Chips', 'Crispy fried chips',
     'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80', 2000, 500, 1)`,
    [rid, sidesId],
  );
  await run(
    `INSERT INTO menu_items(restaurantId, categoryId, name, description, imageUrl, basePrice, adminMarkup, isAvailable)
     VALUES(?, ?, 'Soda', 'Cold soda 500ml',
     'https://images.unsplash.com/photo-1544145945-f90425316c8c?auto=format&fit=crop&w=600&q=80', 1000, 200, 1)`,
    [rid, sidesId],
  );

  const defaults: Record<string, string> = {
    platformName: "Kigali Taste",
    logoUrl: "",
    faviconUrl: "",
    phone: "+250 780 000 000",
    email: "info@kigalitaste.co",
    whatsapp: "+250 780 000 000",
    address: "Kacyiru, Kigali, Rwanda",
    facebook: "",
    instagram: "",
    deliveryFee: "1500",
    orderPrefix: "KT",
    terms:
      "By using Kigali Taste you agree to pay the listed price in Rwandan Francs (FRw). Delivery in Kigali is handled by the platform. Vendors prepare food; Kigali Taste delivers.",
  };
  for (const [key, value] of Object.entries(defaults)) {
    await setSetting(key, value);
  }
  const { seedHeroSettingsIfMissing } = await import("./heroDefaults.ts");
  await seedHeroSettingsIfMissing(
    (key) => setting(key),
    (key, value) => setSetting(key, value),
  );
  const { seedAboutSettingsIfMissing } = await import("./aboutDefaults.ts");
  await seedAboutSettingsIfMissing(
    (key) => setting(key),
    (key, value) => setSetting(key, value),
  );
  const { seedNewsletterSettingsIfMissing } = await import("./newsletterDefaults.ts");
  await seedNewsletterSettingsIfMissing(
    (key) => setting(key),
    (key, value) => setSetting(key, value),
  );
  const { seedFaqSettingsIfMissing } = await import("./faqDefaults.ts");
  await seedFaqSettingsIfMissing(
    (key) => setting(key),
    (key, value) => setSetting(key, value),
  );
  const { seedShippingSettingsIfMissing } = await import("./shippingDefaults.ts");
  await seedShippingSettingsIfMissing(
    (key) => setting(key),
    (key, value) => setSetting(key, value),
  );
}
