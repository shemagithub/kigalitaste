import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { api, frw } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Btn, Card, DocViewer, Empty, Field, ImagePicker, Input, Textarea, BrandName, ConfirmDialog } from "./ui";
import { img } from "@/lib/api";
import { bumpCatalog, refreshSettings } from "./catalog";
import { PanelShell } from "./PanelShell";
import { PayoutsPage } from "./Payouts";
import { TransactionsPage } from "./Transactions";
import { AdminDashboard } from "./admin/AdminDashboard";
import { AdminDelivery } from "./admin/AdminDelivery";
import { AdminDeliveryZones } from "./admin/AdminDeliveryZones";
import { AdminAbout } from "./admin/AdminAbout";
import { AdminFaq } from "./admin/AdminFaq";
import { AdminShipping } from "./admin/AdminShipping";
import { AdminHero } from "./admin/AdminHero";
import { AdminMenus } from "./admin/AdminMenus";
import { AdminNewsletter } from "./admin/AdminNewsletter";
import { AdminMailbox } from "./admin/AdminMailbox";
import { AdminReviews } from "./admin/AdminReviews";
import { AdminPromos } from "./admin/AdminPromos";
import { AdminRestaurants } from "./admin/AdminRestaurants";
import { AdminGuide, FilterTabs, StatusChip } from "./admin/AdminUi";

const ADMIN_NAV = [
  ["dashboard", "Dashboard"],
  ["hero", "Homepage hero"],
  ["about", "About page"],
  ["faq", "FAQ page"],
  ["shipping", "Shipping page"],
  ["vendors", "Vendors"],
  ["restaurants", "Restaurants"],
  ["menus", "Menus"],
  ["customers", "Customers"],
  ["orders", "Orders"],
  ["reviews", "Reviews"],
  ["promos", "Promo codes"],
  ["delivery", "Delivery"],
  ["delivery-zones", "Delivery areas"],
  ["wallet", "Wallet & payouts"],
  ["transactions", "Transactions"],
  ["mailbox", "Mailbox"],
  ["newsletter", "Newsletter"],
  ["settings", "Settings"],
];

const ADMIN_PAGES = ADMIN_NAV.map(([id]) => id);

export function AdminApp() {
  const [loc, setLoc] = useLocation();
  const { user, logout, ready } = useAuth();
  const path = (loc.split("?")[0] || "/admin").replace(/\/$/, "") || "/admin";
  const slug = path.replace(/^\/admin\/?/, "") || "dashboard";
  const tab = ADMIN_PAGES.includes(slug) ? slug : "dashboard";

  useEffect(() => {
    if (!ready || path === "/admin/login") return;
    if (slug === "markup") {
      setLoc("/admin/menus");
      return;
    }
    if (path === "/admin" || !ADMIN_PAGES.includes(slug)) {
      setLoc("/admin/dashboard");
    }
  }, [ready, path, slug, setLoc]);

  if (!ready) return null;
  if (path === "/admin/login" || !user || user.role !== "admin") {
    return <AdminLogin onDone={() => setLoc("/admin/dashboard")} />;
  }

  return (
    <PanelShell
      title="Admin"
      basePath="/admin"
      nav={ADMIN_NAV}
      tab={tab}
      onLogout={() => {
        logout();
        setLoc("/admin/login");
      }}
    >
      {tab === "dashboard" && <AdminDashboard />}
      {tab === "hero" && <AdminHero />}
      {tab === "about" && <AdminAbout />}
      {tab === "faq" && <AdminFaq />}
      {tab === "shipping" && <AdminShipping />}
      {tab === "vendors" && <Vendors />}
      {tab === "restaurants" && <AdminRestaurants />}
      {tab === "menus" && <AdminMenus />}
      {tab === "customers" && <Customers />}
      {tab === "orders" && <Orders />}
      {tab === "reviews" && <AdminReviews />}
      {tab === "promos" && <AdminPromos />}
      {tab === "delivery" && <AdminDelivery />}
      {tab === "delivery-zones" && <AdminDeliveryZones />}
      {tab === "wallet" && <PayoutsPage role="admin" />}
      {tab === "transactions" && <TransactionsPage role="admin" />}
      {tab === "mailbox" && <AdminMailbox />}
      {tab === "newsletter" && <AdminNewsletter />}
      {tab === "settings" && <Settings />}
    </PanelShell>
  );
}

function AdminLogin({ onDone }: { onDone: () => void }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("admin@kigalitaste.rw");
  const [password, setPassword] = useState("admin123");
  return (
    <div className="panel flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md space-y-4">
        <h1 className="text-2xl font-extrabold">Admin login</h1>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await login(email, password);
              onDone();
            } catch (err) {
              toast.error((err as Error).message);
            }
          }}
        >
          <Field label="Email">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Btn className="w-full" type="submit">
            Log in
          </Btn>
        </form>
        <Link href="/forgot-password" className="text-sm text-primary">
          Forgot password?
        </Link>
        <Link href="/" className="text-sm text-primary">
          Back to site
        </Link>
      </Card>
    </div>
  );
}

type VendorRow = {
  id: number;
  businessName: string;
  businessAddress: string;
  businessType: string;
  nationalIdUrl: string;
  rdbCertificateUrl: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: string;
  rejectionReason: string | null;
  suspended: number;
  isLive: number | null;
  restaurantId: number | null;
  slug: string | null;
};

function Vendors() {
  const [tab, setTab] = useState("PENDING_APPROVAL");
  const [rows, setRows] = useState<VendorRow[]>([]);
  const [reason, setReason] = useState("Documents not clear");
  async function reload() {
    const data = await api<VendorRow[]>(
      tab === "SUSPENDED" ? "/api/admin/vendors?status=APPROVED" : `/api/admin/vendors?status=${tab}`,
    );
    setRows(tab === "SUSPENDED" ? data.filter((v) => v.suspended) : data);
  }
  useEffect(() => {
    reload().catch((e) => toast.error(e.message));
  }, [tab]);

  return (
    <div className="space-y-4">
      <AdminGuide>
        <p className="font-bold">Vendor onboarding</p>
        <p className="mt-1 text-muted-foreground">
          Review documents, approve to create their shop, or reject with a reason. Suspend approved vendors to hide their
          kitchen from customers without deleting their account.
        </p>
      </AdminGuide>

      <FilterTabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "PENDING_APPROVAL", label: "Pending" },
          { id: "APPROVED", label: "Approved" },
          { id: "SUSPENDED", label: "Suspended" },
          { id: "REJECTED", label: "Rejected" },
        ]}
      />

      {rows.length === 0 && <Empty title="None" body="Nothing in this tab." />}
      {rows.map((v) => (
        <Card key={v.id} className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-bold">{v.businessName}</p>
            <StatusChip status={v.status} />
            {v.suspended ? <StatusChip status="SUSPENDED" /> : null}
            {v.isLive ? <StatusChip status="LIVE" /> : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {v.businessType} · {v.businessAddress}
          </p>
          <p className="text-sm">
            {v.firstName} {v.lastName} · {v.email} · {v.phone}
          </p>
          {v.slug ? (
            <Link href={`/r/${v.slug}`} className="text-sm font-semibold text-[#0d4f46] underline">
              View restaurant on site
            </Link>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <DocViewer label="National ID" src={v.nationalIdUrl} />
            <DocViewer label="RDB certificate" src={v.rdbCertificateUrl} />
          </div>
          {tab === "PENDING_APPROVAL" && (
            <div className="flex flex-wrap items-end gap-2">
              <Btn
                onClick={async () => {
                  await api(`/api/admin/vendors/${v.id}/approve`, { method: "POST" });
                  toast.success("Approved — they can log in");
                  bumpCatalog();
                  await reload();
                }}
              >
                Approve
              </Btn>
              <Field label="Reject reason">
                <Input value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
              <Btn
                variant="destructive"
                onClick={async () => {
                  await api(`/api/admin/vendors/${v.id}/reject`, {
                    method: "POST",
                    json: { reason },
                  });
                  toast.success("Rejected");
                  await reload();
                }}
              >
                Reject
              </Btn>
            </div>
          )}
          {tab === "APPROVED" && !v.suspended && (
            <Btn
              variant="destructive"
              onClick={async () => {
                await api(`/api/admin/vendors/${v.id}/suspend`, { method: "POST" });
                toast.success("Suspended — hidden from customers");
                bumpCatalog();
                await reload();
              }}
            >
              Suspend vendor
            </Btn>
          )}
          {(tab === "SUSPENDED" || (tab === "APPROVED" && v.suspended)) && (
            <Btn
              onClick={async () => {
                await api(`/api/admin/vendors/${v.id}/unsuspend`, { method: "POST" });
                toast.success("Unsuspended — vendor can go live again");
                bumpCatalog();
                await reload();
              }}
            >
              Unsuspend vendor
            </Btn>
          )}
          {v.rejectionReason && <p className="text-sm text-destructive">{v.rejectionReason}</p>}
        </Card>
      ))}
    </div>
  );
}

function Customers() {
  const [rows, setRows] = useState<
    { id: number; firstName: string; lastName: string; email: string; phone: string; orderCount: number; createdAt: string }[]
  >([]);
  const [q, setQ] = useState("");
  useEffect(() => {
    api<typeof rows>("/api/admin/customers").then(setRows).catch((e) => toast.error(e.message));
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (c) =>
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(needle) ||
        c.email.toLowerCase().includes(needle) ||
        c.phone.includes(needle),
    );
  }, [rows, q]);

  return (
    <div className="space-y-4">
      <AdminGuide>
        <p className="font-bold">Customer accounts</p>
        <p className="mt-1 text-muted-foreground">
          Registered customers who order from the site. Use Mailbox to send them a message.
        </p>
      </AdminGuide>
      <Input
        placeholder="Search by name, email or phone"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="max-w-md"
      />
      {filtered.length === 0 ? (
        <Empty title={q ? "No matches" : "No customers yet"} body={q ? "Try another search." : "Customers appear after signup."} />
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <Card key={c.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">
                  {c.firstName} {c.lastName}
                </p>
                <p className="text-sm text-muted-foreground">
                  {c.email} · {c.phone}
                </p>
              </div>
              <div className="text-right text-sm">
                <p className="font-bold text-[#0d4f46]">{c.orderCount} orders</p>
                <p className="text-xs text-muted-foreground">
                  Joined {new Date(c.createdAt).toLocaleDateString("en-GB")}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

type OrderRow = {
  id: number;
  orderNumber: string;
  restaurantName: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  vendorAmount: number;
  platformAmount: number;
  deliveryFee: number;
  total: number;
  createdAt: string;
  items: { name: string; qty: number; basePriceSnapshot: number; markupSnapshot: number }[];
};

function Orders() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [payFilter, setPayFilter] = useState("ALL");
  const [deleteTarget, setDeleteTarget] = useState<OrderRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function reload() {
    setOrders(await api("/api/admin/orders"));
  }
  useEffect(() => {
    reload().catch((e) => toast.error(e.message));
  }, []);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== "ALL" && o.status !== statusFilter) return false;
      if (payFilter === "PAID" && o.paymentStatus !== "PAID") return false;
      if (payFilter === "UNPAID" && o.paymentStatus === "PAID") return false;
      return true;
    });
  }, [orders, statusFilter, payFilter]);

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { ALL: orders.length };
    for (const o of orders) c[o.status] = (c[o.status] || 0) + 1;
    return c;
  }, [orders]);

  async function confirmDeleteOrder() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api(`/api/admin/orders/${deleteTarget.id}`, { method: "DELETE" });
      toast.success(`${deleteTarget.orderNumber} deleted`);
      setDeleteTarget(null);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete order");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete this order?"
        description={
          deleteTarget ? (
            <>
              <p>
                You are about to permanently remove{" "}
                <span className="font-bold text-[#1e293b]">{deleteTarget.orderNumber}</span> from{" "}
                {deleteTarget.restaurantName}.
              </p>
              <ul className="mt-3 list-inside list-disc space-y-1 text-xs">
                <li>Order details and line items</li>
                <li>Related wallet transaction records</li>
              </ul>
              <p className="mt-3 font-semibold text-red-600">This action cannot be undone.</p>
            </>
          ) : null
        }
        confirmLabel="Delete permanently"
        cancelLabel="Keep order"
        loading={deleting}
        onConfirm={() => void confirmDeleteOrder()}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />
      <AdminGuide>
        <p className="font-bold">All orders</p>
        <p className="mt-1 text-muted-foreground">
          Customer total = vendor menu base + your markup + delivery. Wallets credit only after delivery and payment.
          Use Delivery for the active queue. Delete removes the order permanently (including wallet entries tied to it).
        </p>
      </AdminGuide>

      <FilterTabs
        active={statusFilter}
        onChange={setStatusFilter}
        tabs={[
          { id: "ALL", label: "All", count: statusCounts.ALL },
          { id: "PENDING", label: "Pending", count: statusCounts.PENDING },
          { id: "CONFIRMED", label: "Confirmed", count: statusCounts.CONFIRMED },
          { id: "PREPARING", label: "Preparing", count: statusCounts.PREPARING },
          { id: "READY", label: "Ready", count: statusCounts.READY },
          { id: "OUT_FOR_DELIVERY", label: "Out", count: statusCounts.OUT_FOR_DELIVERY },
          { id: "DELIVERED", label: "Delivered", count: statusCounts.DELIVERED },
          { id: "CANCELLED", label: "Cancelled", count: statusCounts.CANCELLED },
        ]}
      />

      <FilterTabs
        active={payFilter}
        onChange={setPayFilter}
        tabs={[
          { id: "ALL", label: "Any payment" },
          { id: "PAID", label: "Paid" },
          { id: "UNPAID", label: "Unpaid" },
        ]}
      />

      {filtered.length === 0 ? (
        <Empty title="No orders" body="Orders appear here when customers checkout." />
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => (
            <Card key={o.id} className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-bold">
                  {o.orderNumber} · {o.restaurantName}
                </p>
                <StatusChip status={o.status} />
                <StatusChip status={o.paymentStatus} />
              </div>
              <p className="text-sm text-muted-foreground">
                {new Date(o.createdAt).toLocaleString("en-GB")} · {o.paymentMethod}
              </p>
              <p className="text-sm">
                {o.customerName} · {o.customerPhone}
              </p>
              <p className="text-sm break-words">{o.deliveryAddress}</p>
              <p className="break-words text-sm">
                {o.items
                  .map(
                    (i) =>
                      `${i.qty}× ${i.name} (base ${frw(i.basePriceSnapshot)} + markup ${frw(i.markupSnapshot)})`,
                  )
                  .join(" · ")}
              </p>
              <div className="grid gap-1 rounded-xl bg-muted/30 p-3 text-sm sm:grid-cols-3">
                <p>
                  <span className="text-muted-foreground">Customer paid</span>
                  <br />
                  <span className="font-bold text-[#0d4f46]">{frw(o.total)}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Vendor earns</span>
                  <br />
                  <span className="font-semibold">{frw(o.vendorAmount)}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Platform earns</span>
                  <br />
                  <span className="font-semibold">
                    {frw(o.platformAmount)} <span className="text-xs font-normal">(incl. delivery {frw(o.deliveryFee)})</span>
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {o.status === "READY" && (
                  <Btn
                    onClick={async () => {
                      await api(`/api/admin/orders/${o.id}/status`, {
                        method: "POST",
                        json: { status: "OUT_FOR_DELIVERY" },
                      });
                      await reload();
                    }}
                  >
                    Start delivery
                  </Btn>
                )}
                {(o.status === "READY" || o.status === "OUT_FOR_DELIVERY") && (
                  <Btn
                    onClick={async () => {
                      await api(`/api/admin/orders/${o.id}/status`, {
                        method: "POST",
                        json: { status: "DELIVERED" },
                      });
                      toast.success("Delivered — wallets updated");
                      await reload();
                    }}
                  >
                    Mark delivered
                  </Btn>
                )}
                {o.status !== "DELIVERED" && o.status !== "CANCELLED" && (
                  <Btn
                    variant="destructive"
                    onClick={async () => {
                      await api(`/api/admin/orders/${o.id}/status`, {
                        method: "POST",
                        json: { status: "CANCELLED" },
                      });
                      await reload();
                    }}
                  >
                    Cancel
                  </Btn>
                )}
                <Btn
                  variant="outline"
                  size="sm"
                  className="border-red-200 text-red-600 hover:bg-red-50"
                  onClick={() => setDeleteTarget(o)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Btn>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function setField(s: Record<string, string>, key: string, value: string) {
  return { ...s, [key]: value };
}

function SettingsSection({
  title,
  body,
  children,
}: {
  title: string;
  body?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="space-y-5 p-6">
      <div className="border-b border-black/5 pb-4">
        <h2 className="text-base font-extrabold text-[#0d4f46]">{title}</h2>
        {body ? <p className="mt-1 text-sm text-muted-foreground">{body}</p> : null}
      </div>
      {children}
    </Card>
  );
}

function Settings() {
  const [s, setS] = useState<Record<string, string>>({});
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoLink, setLogoLink] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<Record<string, string>>("/api/settings").then(setS).catch((e) => toast.error(e.message));
  }, []);

  function patch(key: string, value: string) {
    setS((prev) => setField(prev, key, value));
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const data = await api<Record<string, string>>("/api/admin/settings", { method: "PUT", json: s });
      setS(data);
      bumpCatalog();
      await refreshSettings();
      toast.success("Settings saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function uploadLogo(file: File | null) {
    setLogoFile(file);
    if (!file) return;
    try {
      const form = new FormData();
      form.append("file", file);
      const data = await api<{ url: string }>("/api/admin/settings/logo", { method: "POST", form });
      setS((prev) => setField(prev, "logoUrl", data.url));
      setLogoLink("");
      bumpCatalog();
      await refreshSettings();
      toast.success("Logo updated");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <form
      className="mx-auto max-w-4xl space-y-5 pb-8"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <SettingsSection title="Brand" body="Name and logo shown on the customer site header.">
        <div className="grid gap-6 lg:grid-cols-[220px_1fr] lg:items-start">
          <div className="flex flex-col items-center rounded-2xl bg-[#0d4f46]/5 px-4 py-6 text-center">
            {s.logoUrl ? (
              <img src={img(s.logoUrl)} alt="Logo" className="h-24 w-24 rounded-full object-cover shadow-md ring-2 ring-white" />
            ) : (
              <span className="flex h-24 w-24 items-center justify-center rounded-full bg-[#0d4f46] text-2xl font-extrabold text-white">
                {(s.platformName || "KT").slice(0, 2).toUpperCase()}
              </span>
            )}
            <BrandName name={s.platformName || "Kigali Taste"} size="sm" className="mt-3 text-[#0d4f46]" />
            <p className="text-xs text-muted-foreground">Customer header</p>
          </div>
          <div className="space-y-4">
            <Field label="Platform name">
              <Input
                className="h-12 rounded-2xl"
                value={s.platformName || ""}
                onChange={(e) => patch("platformName", e.target.value)}
                placeholder="Kigali Taste"
              />
            </Field>
            <ImagePicker
              label="Logo"
              file={logoFile}
              url={logoLink}
              existingUrl={s.logoUrl}
              onFile={(file) => void uploadLogo(file)}
              onUrl={setLogoLink}
              onCommitUrl={(url) => {
                patch("logoUrl", url);
                setLogoFile(null);
                toast.message("Save settings to keep this logo address");
              }}
            />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Contact" body="How customers reach Kigali Taste.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone">
            <Input
              className="h-12 rounded-2xl"
              value={s.phone || ""}
              onChange={(e) => patch("phone", e.target.value)}
              placeholder="+250 780 000 000"
            />
          </Field>
          <Field label="WhatsApp">
            <Input
              className="h-12 rounded-2xl"
              value={s.whatsapp || ""}
              onChange={(e) => patch("whatsapp", e.target.value)}
              placeholder="+250 780 000 000"
            />
          </Field>
          <Field label="Email">
            <Input
              className="h-12 rounded-2xl"
              type="email"
              value={s.email || ""}
              onChange={(e) => patch("email", e.target.value)}
              placeholder="hello@kigalitaste.rw"
            />
          </Field>
          <Field label="Address">
            <Input
              className="h-12 rounded-2xl"
              value={s.address || ""}
              onChange={(e) => patch("address", e.target.value)}
              placeholder="Kacyiru, Kigali, Rwanda"
            />
          </Field>
        </div>
      </SettingsSection>

      <SettingsSection title="Social" body="Optional public profile links.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Facebook">
            <Input
              className="h-12 rounded-2xl"
              value={s.facebook || ""}
              onChange={(e) => patch("facebook", e.target.value)}
              placeholder="https://facebook.com/kigalitaste"
            />
          </Field>
          <Field label="Instagram">
            <Input
              className="h-12 rounded-2xl"
              value={s.instagram || ""}
              onChange={(e) => patch("instagram", e.target.value)}
              placeholder="https://instagram.com/kigalitaste"
            />
          </Field>
        </div>
      </SettingsSection>

      <SettingsSection title="Orders" body="Customer checkout uses these values.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Delivery fee (FRw)">
            <Input
              className="h-12 rounded-2xl"
              inputMode="numeric"
              value={s.deliveryFee || ""}
              onChange={(e) => patch("deliveryFee", e.target.value)}
              placeholder="1500"
            />
          </Field>
          <Field label="Order prefix">
            <Input
              className="h-12 max-w-[10rem] rounded-2xl uppercase"
              value={s.orderPrefix || ""}
              onChange={(e) => patch("orderPrefix", e.target.value.toUpperCase())}
              placeholder="KT"
              maxLength={6}
            />
          </Field>
        </div>
        <p className="text-xs text-muted-foreground">
          Delivery fee is added on the customer cart. Prefix appears on order numbers, for example KT-1001.
        </p>
      </SettingsSection>

      <SettingsSection title="Terms" body="Shown to customers on the site.">
        <Textarea
          className="min-h-36 rounded-2xl"
          value={s.terms || ""}
          onChange={(e) => patch("terms", e.target.value)}
        />
      </SettingsSection>

      <div
        className="sticky bottom-3 flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-card sm:flex-row sm:items-center sm:justify-between"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <p className="text-sm text-muted-foreground">Changes go live on the customer site as soon as you save.</p>
        <Btn type="submit" disabled={saving} className="sm:min-w-40">
          {saving ? "Saving…" : "Save settings"}
        </Btn>
      </div>
    </form>
  );
}
