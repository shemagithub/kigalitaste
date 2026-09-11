import nodemailer from "nodemailer";
import { many, one } from "./db.ts";

const ORANGE = "#ea580c";
const INK = "#1c1917";
const MUTED = "#78716c";
const CREAM = "#fff7ed";
const CARD = "#ffffff";

type MailItem = { name: string; qty: number; price: number };

type OrderMail = {
  id: number;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  deliveryFee: number;
  vendorAmount: number;
  platformAmount: number;
  deliveryAddress: string;
  customerPhone: string;
  customerName: string;
  notes: string | null;
  fulfillment: string;
  createdAt: string;
  restaurantName: string;
  restaurantAddress: string;
  restaurantPhone: string;
  customerEmail: string;
  customerFirst: string;
  vendorEmail: string;
  businessName: string;
  items: MailItem[];
  total: number;
};

function appUrl() {
  return (process.env.PUBLIC_APP_URL || "http://localhost:5173").replace(/\/$/, "");
}

function frw(amount: number) {
  return `${Math.round(amount).toLocaleString("en-RW")} FRw`;
}

function mailConfigured() {
  return Boolean(process.env.MAIL_USER && process.env.MAIL_PASS);
}

export function businessNotifyEmail() {
  return (
    process.env.BUSINESS_NOTIFY_EMAIL ||
    process.env.MAIL_FROM ||
    process.env.MAIL_USER ||
    "info@kigalitaste.co"
  );
}

function transporter() {
  const host = process.env.MAIL_HOST || "kigalitaste.co";
  const port = Number(process.env.MAIL_PORT || 465);
  const user = process.env.MAIL_USER || "";
  const pass = (process.env.MAIL_PASS || "").replace(/\s+/g, "");
  const secure = process.env.MAIL_SECURE !== "false" && port === 465;
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

function fromAddress() {
  const user = process.env.MAIL_USER || "";
  const from = process.env.MAIL_FROM || user;
  return `"Kigali Taste" <${from}>`;
}

function wrap(title: string, inner: string) {
  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:${CREAM};font-family:Arial,Helvetica,sans-serif;color:${INK}">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${CREAM};padding:28px 12px">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;background:${CARD};border-radius:24px;overflow:hidden;box-shadow:0 12px 40px rgba(234,88,12,0.12)">
          <tr>
            <td style="background:linear-gradient(135deg,${ORANGE},#c2410c);padding:28px 32px;color:#fff">
              <p style="margin:0;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;opacity:.85">Kigali Taste</p>
              <h1 style="margin:8px 0 0;font-size:26px;line-height:1.2">${title}</h1>
              <p style="margin:8px 0 0;font-size:13px;opacity:.9">Good food, delivered in Kigali · FRw</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px">${inner}</td>
          </tr>
          <tr>
            <td style="padding:18px 32px 28px;font-size:12px;color:${MUTED};line-height:1.5">
              Questions? Reply to this email or open
              <a href="${appUrl()}/contact" style="color:${ORANGE};font-weight:700">Contact</a>.
              <br />Kigali Taste · Kigali, Rwanda
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function btn(href: string, label: string) {
  return `<p style="margin:24px 0 8px">
    <a href="${href}" style="display:inline-block;background:${ORANGE};color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px">${label}</a>
  </p>`;
}

function itemsTable(items: MailItem[]) {
  const rows = items
    .map(
      (item) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #f4e6d8">${item.qty}× ${escapeHtml(item.name)}</td>
        <td style="padding:8px 0;border-bottom:1px solid #f4e6d8;text-align:right;font-weight:700">${frw(item.price * item.qty)}</td>
      </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:12px 0 8px">${rows}</table>`;
}

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function payLabel(method: string) {
  if (method === "CARD") return "Card";
  if (method === "AIRTEL") return "Airtel Money";
  if (method === "COD") return "Cash";
  return "MTN MoMo";
}

function fulfillLabel(order: OrderMail) {
  if (String(order.fulfillment || "").toUpperCase() === "PICKUP") {
    return `Pickup at ${order.restaurantName}`;
  }
  return `Delivery to ${order.deliveryAddress}`;
}

async function loadOrderMail(orderId: number): Promise<OrderMail | undefined> {
  const order = await one<{
    id: number;
    orderNumber: string;
    status: string;
    paymentMethod: string;
    paymentStatus: string;
    deliveryFee: number;
    vendorAmount: number;
    platformAmount: number;
    deliveryAddress: string;
    customerPhone: string;
    customerName: string;
    notes: string | null;
    fulfillment: string;
    createdAt: string;
    restaurantName: string;
    restaurantAddress: string;
    restaurantPhone: string;
    customerEmail: string;
    customerFirst: string;
    vendorEmail: string;
    businessName: string;
  }>(
    `SELECT o.id, o.orderNumber, o.status, o.paymentMethod, o.paymentStatus, o.deliveryFee,
            o.vendorAmount, o.platformAmount, o.deliveryAddress, o.customerPhone, o.customerName,
            o.notes, o.fulfillment, o.createdAt,
            r.name AS restaurantName, r.address AS restaurantAddress, r.phone AS restaurantPhone,
            u.email AS customerEmail, u.firstName AS customerFirst,
            vu.email AS vendorEmail, v.businessName
     FROM orders o
     JOIN restaurants r ON r.id = o.restaurantId
     JOIN users u ON u.id = o.customerId
     JOIN vendors v ON v.id = r.vendorId
     JOIN users vu ON vu.id = v.userId
     WHERE o.id = ?`,
    [orderId],
  );
  if (!order) return undefined;
  const items = await many<MailItem>(
    "SELECT nameSnapshot AS name, qty, (basePriceSnapshot + markupSnapshot) AS price FROM order_items WHERE orderId = ?",
    [orderId],
  );
  return {
    ...order,
    items,
    total: order.vendorAmount + order.platformAmount,
  };
}

function receiptHtml(order: OrderMail) {
  const date = new Date(order.createdAt).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const food = order.total - order.deliveryFee;
  const rows = order.items
    .map(
      (item) => `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #f4e6d8">${escapeHtml(item.name)}</td>
        <td style="padding:10px 0;border-bottom:1px solid #f4e6d8;text-align:center">${item.qty}</td>
        <td style="padding:10px 0;border-bottom:1px solid #f4e6d8;text-align:right">${frw(item.price)}</td>
        <td style="padding:10px 0;border-bottom:1px solid #f4e6d8;text-align:right;font-weight:700">${frw(item.price * item.qty)}</td>
      </tr>`,
    )
    .join("");
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt ${escapeHtml(order.orderNumber)}</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; color: ${INK}; background: ${CREAM}; margin: 0; padding: 32px 16px; }
    .sheet { max-width: 640px; margin: 0 auto; background: #fff; border-radius: 28px; overflow: hidden; box-shadow: 0 16px 40px rgba(234,88,12,.12); }
    .hero { background: linear-gradient(135deg, ${ORANGE}, #c2410c); color: #fff; padding: 32px; }
    .hero p { margin: 0; letter-spacing: .2em; text-transform: uppercase; font-size: 11px; opacity: .85; }
    h1 { margin: 8px 0 0; font-size: 28px; }
    .body { padding: 28px 32px 36px; }
    table { width: 100%; border-collapse: collapse; }
    .muted { color: ${MUTED}; font-size: 13px; }
    .paid { display: inline-block; background: #dcfce7; color: #166534; font-weight: 800; padding: 6px 12px; border-radius: 999px; font-size: 12px; }
    .total { font-size: 22px; font-weight: 800; }
    @media print { body { background: #fff; padding: 0; } .sheet { box-shadow: none; border-radius: 0; } }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="hero">
      <p>Kigali Taste</p>
      <h1>Payment receipt</h1>
      <p style="letter-spacing:0;text-transform:none;margin-top:8px;font-size:14px">${escapeHtml(order.orderNumber)} · ${escapeHtml(date)}</p>
    </div>
    <div class="body">
      <p class="paid">PAID · ${escapeHtml(payLabel(order.paymentMethod))}</p>
      <p style="margin:16px 0 4px"><strong>${escapeHtml(order.customerName)}</strong></p>
      <p class="muted">${escapeHtml(order.customerPhone)} · ${escapeHtml(fulfillLabel(order))}</p>
      <p class="muted" style="margin-top:8px">${escapeHtml(order.restaurantName)}<br />${escapeHtml(order.restaurantAddress)} · ${escapeHtml(order.restaurantPhone)}</p>
      <table style="margin-top:20px">
        <tr class="muted">
          <th align="left" style="padding-bottom:8px">Item</th>
          <th>Qty</th>
          <th align="right">Each</th>
          <th align="right">Total</th>
        </tr>
        ${rows}
      </table>
      <p style="display:flex;justify-content:space-between;margin:16px 0 0"><span>Food</span><strong>${frw(food)}</strong></p>
      <p style="display:flex;justify-content:space-between;margin:6px 0 0"><span>${String(order.fulfillment || "").toUpperCase() === "PICKUP" ? "Pickup" : "Delivery"}</span><strong>${order.deliveryFee ? frw(order.deliveryFee) : "Free"}</strong></p>
      <p class="total" style="display:flex;justify-content:space-between;margin:14px 0 0;border-top:2px solid ${ORANGE};padding-top:12px"><span>Total</span><span>${frw(order.total)}</span></p>
      <p class="muted" style="margin-top:28px">Thank you for ordering with Kigali Taste. Keep this receipt for your records.</p>
    </div>
  </div>
</body>
</html>`;
}

function pdfEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function pdfSafe(value: string) {
  return [...String(value)]
    .map((ch) => {
      const code = ch.charCodeAt(0);
      return code < 32 || code > 126 ? "?" : ch;
    })
    .join("");
}

function receiptPdf(order: OrderMail) {
  const date = new Date(order.createdAt).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const food = order.total - order.deliveryFee;
  const lines: { text: string; size: number; y: number; bold?: boolean }[] = [];
  let y = 760;
  const push = (text: string, size = 11, bold = false) => {
    lines.push({ text: pdfSafe(text), size, y, bold });
    y -= size + 8;
  };
  push("KIGALI TASTE", 18, true);
  push("Payment receipt", 14, true);
  push(`${order.orderNumber}  ·  ${date}`);
  push(`PAID  ·  ${payLabel(order.paymentMethod)}`, 12, true);
  y -= 8;
  push(order.customerName, 12, true);
  push(order.customerPhone);
  push(fulfillLabel(order));
  push(`${order.restaurantName}  ·  ${order.restaurantAddress}`);
  y -= 6;
  for (const item of order.items) {
    push(`${item.qty} x ${item.name}     ${frw(item.price * item.qty)}`);
  }
  y -= 6;
  push(`Food     ${frw(food)}`);
  push(
    `${String(order.fulfillment || "").toUpperCase() === "PICKUP" ? "Pickup" : "Delivery"}     ${order.deliveryFee ? frw(order.deliveryFee) : "Free"}`,
  );
  push(`TOTAL     ${frw(order.total)}`, 14, true);
  y -= 10;
  push("Thank you for ordering with Kigali Taste.");

  const ops = [
    "0.918 0.345 0.047 rg",
    "40 790 515 36 re f",
    "1 1 1 rg",
    "BT",
    "/F2 14 Tf",
    "56 802 Td",
    "(Kigali Taste receipt) Tj",
    "ET",
    "0 0 0 rg",
    "BT",
    ...lines.flatMap((line) => [
      `${line.bold ? "/F2" : "/F1"} ${line.size} Tf`,
      `1 0 0 1 50 ${line.y} Tm`,
      `(${pdfEscape(line.text)}) Tj`,
    ]),
    "ET",
  ].join("\n");

  const objects: string[] = [];
  const add = (body: string) => {
    objects.push(body);
    return objects.length;
  };
  const catalog = add("<< /Type /Catalog /Pages 2 0 R >>");
  const pages = add("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  const page = add(
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>",
  );
  const contents = add(`<< /Length ${Buffer.byteLength(ops)} >>\nstream\n${ops}\nendstream`);
  const f1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const f2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  void catalog;
  void pages;
  void page;
  void contents;
  void f1;
  void f2;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

function stripHtml(html: string) {
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function mailboxHtmlBody(subject: string, htmlBody: string) {
  const inner = htmlBody.trim();
  if (!inner) return wrap(subject, `<p style="margin:0;font-size:15px;line-height:1.7">&nbsp;</p>`);
  if (/<html[\s>]/i.test(inner)) return inner;
  return `<!doctype html>
<html>
<body style="margin:0;padding:24px 16px;background:#fff7ed;font-family:Arial,Helvetica,sans-serif;color:${INK}">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:16px;padding:28px 32px;box-shadow:0 8px 24px rgba(0,0,0,.06)">
    <p style="margin:0 0 20px;font-size:13px;color:${MUTED};font-weight:700;text-transform:uppercase;letter-spacing:.12em">Kigali Taste</p>
    <div style="font-size:15px;line-height:1.7;color:${INK}">${inner}</div>
    <p style="margin:28px 0 0;padding-top:16px;border-top:1px solid #f4e6d8;font-size:12px;color:${MUTED}">
      Sent via Kigali Taste · ${escapeHtml(businessNotifyEmail())}
    </p>
  </div>
</body>
</html>`;
}

async function sendMail(opts: {
  to: string | string[];
  subject: string;
  text: string;
  html: string;
  attachments?: { filename: string; content: Buffer | string; contentType?: string }[];
  replyTo?: string;
  bcc?: string | string[];
}) {
  if (!mailConfigured()) {
    console.warn("Email skipped (MAIL_USER / MAIL_PASS not set):", opts.subject);
    return false;
  }
  try {
    await transporter().sendMail({
      from: fromAddress(),
      to: opts.to,
      bcc: opts.bcc,
      replyTo: opts.replyTo,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
      attachments: opts.attachments,
    });
    return true;
  } catch (err) {
    console.error("Email send failed:", opts.subject, (err as Error).message);
    throw err;
  }
}

/** Admin mailbox compose / reply — sends from info@kigalitaste.co */
export async function sendMailboxEmail(opts: {
  to: string | string[];
  subject: string;
  body: string;
  htmlBody?: string;
  replyTo?: string;
  bcc?: string | string[];
  attachments?: { filename: string; content: Buffer | string; contentType?: string }[];
}) {
  const plain = opts.body.trim() || stripHtml(opts.htmlBody || "");
  const html = opts.htmlBody?.trim()
    ? mailboxHtmlBody(opts.subject, opts.htmlBody)
    : wrap(
        opts.subject,
        `<p style="margin:0;font-size:15px;line-height:1.7;white-space:pre-wrap">${escapeHtml(plain)}</p>`,
      );
  return sendMail({
    to: opts.to,
    bcc: opts.bcc,
    subject: opts.subject,
    text: plain,
    html,
    replyTo: opts.replyTo || businessNotifyEmail(),
    attachments: opts.attachments,
  });
}

export async function notifyBusinessInbox(opts: {
  subject: string;
  body: string;
  fromName?: string;
  fromEmail?: string;
}) {
  const to = businessNotifyEmail();
  const detail = opts.fromEmail
    ? `<p style="margin:0 0 12px;color:${MUTED};font-size:13px">From ${escapeHtml(opts.fromName || "Someone")} · ${escapeHtml(opts.fromEmail)}</p>`
    : "";
  const html = wrap(
    opts.subject,
    `${detail}<p style="margin:0;font-size:15px;line-height:1.7;white-space:pre-wrap">${escapeHtml(opts.body)}</p>
     ${btn(`${appUrl()}/admin/mailbox`, "Open admin mailbox")}`,
  );
  return sendMail({
    to,
    subject: `[Kigali Taste] ${opts.subject}`,
    text: `${opts.fromName ? `${opts.fromName} (${opts.fromEmail})\n\n` : ""}${opts.body}`,
    html,
    replyTo: opts.fromEmail,
  });
}

async function notifyBusinessNewOrder(order: OrderMail) {
  await notifyBusinessInbox({
    subject: `New order ${order.orderNumber} · ${frw(order.total)}`,
    body: `${order.customerName} (${order.customerEmail}) · ${order.customerPhone}\n${fulfillLabel(order)}\n${order.deliveryAddress || order.restaurantName}\n\n${order.items.map((i) => `${i.qty}× ${i.name}`).join("\n")}\n\nTotal ${frw(order.total)} · ${payLabel(order.paymentMethod)} · ${order.paymentStatus}`,
    fromName: order.customerName,
    fromEmail: order.customerEmail,
  });
}

export async function sendVerificationEmail(to: string, code: string) {
  const html = wrap(
    "Verify your email",
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.6">Use this code to finish creating your Kigali Taste account. It expires in 15 minutes.</p>
     <div style="background:${CREAM};border:1px dashed ${ORANGE};border-radius:18px;padding:18px;text-align:center">
       <p style="margin:0;font-size:34px;letter-spacing:10px;font-weight:800;color:${ORANGE}">${code}</p>
     </div>
     <p style="margin:18px 0 0;color:${MUTED};font-size:13px">If you did not request this, you can ignore this email.</p>`,
  );
  await sendMail({
    to,
    subject: `${code} is your Kigali Taste verification code`,
    text: `Your Kigali Taste verification code is ${code}. It expires in 15 minutes.`,
    html,
  });
}

export async function sendPasswordResetEmail(to: string, code: string) {
  const resetUrl = `${appUrl()}/reset-password?email=${encodeURIComponent(to)}`;
  const html = wrap(
    "Reset your password",
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.6">Use this code to reset your Kigali Taste password. It expires in 15 minutes.</p>
     <div style="background:${CREAM};border:1px dashed ${ORANGE};border-radius:18px;padding:18px;text-align:center">
       <p style="margin:0;font-size:34px;letter-spacing:10px;font-weight:800;color:${ORANGE}">${code}</p>
     </div>
     <p style="margin:18px 0 0;font-size:14px;line-height:1.6">Or open <a href="${resetUrl}" style="color:${ORANGE};font-weight:700">${resetUrl}</a> and enter the code with your new password.</p>
     <p style="margin:18px 0 0;color:${MUTED};font-size:13px">If you did not request a password reset, you can ignore this email.</p>`,
  );
  await sendMail({
    to,
    subject: `${code} — reset your Kigali Taste password`,
    text: `Your Kigali Taste password reset code is ${code}. It expires in 15 minutes. Open ${resetUrl} to choose a new password.`,
    html,
  });
}

const CUSTOMER_COPY: Record<string, { title: string; body: string; cta: string }> = {
  placed: {
    title: "We received your order",
    body: "The kitchen will see it as soon as payment is confirmed.",
    cta: "Track my order",
  },
  paid: {
    title: "Payment received",
    body: "Your receipt is attached. The restaurant can now start preparing your food.",
    cta: "View my order",
  },
  accepted: {
    title: "The kitchen accepted your order",
    body: "They have your ticket and will start cooking shortly.",
    cta: "Track my order",
  },
  preparing: {
    title: "Your food is being prepared",
    body: "The kitchen is cooking your order now.",
    cta: "Track my order",
  },
  ready: {
    title: "Your order is ready",
    body: "If you chose pickup, collect it at the restaurant. If you chose delivery, a rider will take it next.",
    cta: "Track my order",
  },
  out_for_delivery: {
    title: "Your order is on the way",
    body: "Kigali Taste is bringing your food to the delivery address.",
    cta: "Track my order",
  },
  delivered: {
    title: "Enjoy your meal",
    body: "Your order was delivered. Thank you for choosing Kigali Taste.",
    cta: "My orders",
  },
  cancelled: {
    title: "Order cancelled",
    body: "This order was cancelled. If you already paid, contact Kigali Taste for help.",
    cta: "Browse restaurants",
  },
};

function customerHtml(order: OrderMail, kind: keyof typeof CUSTOMER_COPY) {
  const copy = CUSTOMER_COPY[kind];
  const href = kind === "cancelled" ? `${appUrl()}/` : `${appUrl()}/orders`;
  return wrap(
    copy.title,
    `<p style="margin:0 0 8px;font-size:15px">Hi ${escapeHtml(order.customerFirst)},</p>
     <p style="margin:0 0 16px;font-size:15px;line-height:1.6">${copy.body}</p>
     <p style="margin:0 0 4px;font-size:13px;color:${MUTED}">${escapeHtml(order.orderNumber)} · ${escapeHtml(order.restaurantName)}</p>
     <p style="margin:0 0 8px;font-size:13px;color:${MUTED}">${escapeHtml(fulfillLabel(order))}</p>
     ${itemsTable(order.items)}
     <p style="margin:12px 0 0;font-size:18px;font-weight:800">Total ${frw(order.total)}</p>
     ${btn(href, copy.cta)}`,
  );
}

function kitchenHtml(order: OrderMail, kind: "new" | "cancelled" | "update", headline: string, body: string) {
  return wrap(
    headline,
    `<p style="margin:0 0 12px;font-size:15px;line-height:1.6">${body}</p>
     <p style="margin:0;font-weight:800">${escapeHtml(order.orderNumber)} · ${escapeHtml(order.customerName)}</p>
     <p style="margin:6px 0 0;color:${MUTED};font-size:13px">${escapeHtml(order.customerPhone)} · ${escapeHtml(fulfillLabel(order))}</p>
     ${order.notes ? `<p style="margin:10px 0 0;font-size:13px"><strong>Notes:</strong> ${escapeHtml(order.notes)}</p>` : ""}
     ${itemsTable(order.items)}
     <p style="margin:12px 0 0;font-size:18px;font-weight:800">Customer total ${frw(order.total)}</p>
     ${kind !== "cancelled" ? btn(`${appUrl()}/vendor`, "Open vendor orders") : ""}`,
  );
}

export async function notifyOrderPlaced(orderId: number) {
  const order = await loadOrderMail(orderId);
  if (!order) return;
  const copy = CUSTOMER_COPY.placed;
  await sendMail({
    to: order.customerEmail,
    subject: `${order.orderNumber} · We received your Kigali Taste order`,
    text: `${copy.title}. ${order.orderNumber} at ${order.restaurantName}. Total ${frw(order.total)}.`,
    html: customerHtml(order, "placed"),
  });
  await notifyBusinessNewOrder(order);
  if (order.paymentMethod === "COD") {
    await notifyKitchenNew(order);
  }
}

export async function notifyOrderPaid(orderId: number) {
  const order = await loadOrderMail(orderId);
  if (!order) return;
  const copy = CUSTOMER_COPY.paid;
  const filename = `Kigali-Taste-Receipt-${order.orderNumber}.html`;
  const pdfName = `Kigali-Taste-Receipt-${order.orderNumber}.pdf`;
  await sendMail({
    to: order.customerEmail,
    subject: `${order.orderNumber} · Payment received — receipt attached`,
    text: `Payment received for ${order.orderNumber}. Total ${frw(order.total)}. Your receipt is attached.`,
    html: customerHtml(order, "paid"),
    attachments: [
      { filename: pdfName, content: receiptPdf(order), contentType: "application/pdf" },
      { filename, content: receiptHtml(order), contentType: "text/html" },
    ],
  });
  await notifyBusinessNewOrder(order);
  if (order.paymentMethod !== "COD") {
    await notifyKitchenNew(order);
  }
}

async function notifyKitchenNew(order: OrderMail) {
  await sendMail({
    to: order.vendorEmail,
    subject: `New order ${order.orderNumber} · ${order.customerName}`,
    text: `New order ${order.orderNumber} from ${order.customerName}. ${fulfillLabel(order)}. Total ${frw(order.total)}.`,
    html: kitchenHtml(
      order,
      "new",
      "New order in your kitchen",
      `A customer just placed an order at ${order.restaurantName}. Open Vendor → Orders to accept it.`,
    ),
  });
}

export async function notifyOrderStatus(orderId: number, status: string) {
  const order = await loadOrderMail(orderId);
  if (!order) return;
  const map: Record<string, keyof typeof CUSTOMER_COPY> = {
    ACCEPTED: "accepted",
    PREPARING: "preparing",
    READY: "ready",
    OUT_FOR_DELIVERY: "out_for_delivery",
    DELIVERED: "delivered",
    CANCELLED: "cancelled",
  };
  const kind = map[status];
  if (!kind) return;
  const copy = CUSTOMER_COPY[kind];
  await sendMail({
    to: order.customerEmail,
    subject: `${order.orderNumber} · ${copy.title}`,
    text: `${copy.title}. ${order.orderNumber} at ${order.restaurantName}. ${copy.body}`,
    html: customerHtml(order, kind),
  });
  if (status === "CANCELLED") {
    await sendMail({
      to: order.vendorEmail,
      subject: `Cancelled ${order.orderNumber} · ${order.customerName}`,
      text: `Order ${order.orderNumber} was cancelled.`,
      html: kitchenHtml(order, "cancelled", "Order cancelled", "This ticket is no longer active."),
    });
  }
}

export function notifyOrderPlacedSafe(orderId: number) {
  void notifyOrderPlaced(orderId).catch((err) => console.error("Order placed email failed", err));
}

export function notifyOrderPaidSafe(orderId: number) {
  void notifyOrderPaid(orderId).catch((err) => console.error("Payment receipt email failed", err));
}

export function notifyOrderStatusSafe(orderId: number, status: string) {
  void notifyOrderStatus(orderId, status).catch((err) => console.error("Order status email failed", err));
}
