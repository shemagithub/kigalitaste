import { useEffect, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { api, frw } from "@/lib/api";
import { BalanceCard, StatCard } from "../PanelShell";
import { AdminGuide, AdminMetric, QuickLink, StatusChip } from "./AdminUi";

type DashData = {
  platformWallet: number;
  earned: number;
  markupEarned: number;
  deliveryEarned: number;
  pendingEarnings?: number;
  paidOut: number;
  held: number;
  todayOrders: number;
  totalOrders: number;
  activeOrders: number;
  readyForDelivery: number;
  outForDelivery: number;
  awaitingPayment: number;
  pendingVendors: number;
  suspendedVendors: number;
  liveRestaurants: number;
  totalRestaurants: number;
  totalCustomers: number;
  newsletterSubscribers?: number;
  paymentsReady: boolean;
  recentOrders?: {
    id: number;
    orderNumber: string;
    status: string;
    paymentStatus: string;
    restaurantName: string;
    customerName: string;
    total: number;
    createdAt: string;
  }[];
};

export function AdminDashboard() {
  const [d, setD] = useState<DashData | null>(null);

  useEffect(() => {
    api<DashData>("/api/admin/dashboard")
      .then(setD)
      .catch((e) => toast.error(e.message));
  }, []);

  if (!d) return <p className="text-sm text-muted-foreground">Loading control panel…</p>;

  const recentOrders = d.recentOrders ?? [];
  const readyForDelivery = d.readyForDelivery ?? 0;
  const outForDelivery = d.outForDelivery ?? 0;
  const liveRestaurants = d.liveRestaurants ?? 0;
  const totalRestaurants = d.totalRestaurants ?? liveRestaurants;
  const pendingVendors = d.pendingVendors ?? 0;
  const activeOrders = d.activeOrders ?? 0;
  const totalOrders = d.totalOrders ?? 0;
  const awaitingPayment = d.awaitingPayment ?? 0;
  const totalCustomers = d.totalCustomers ?? 0;
  const newsletterSubscribers = d.newsletterSubscribers ?? 0;
  const todayOrders = d.todayOrders ?? 0;
  const deliveryQueue = readyForDelivery + outForDelivery;

  return (
    <div className="space-y-6">
      <AdminGuide>
        <p className="font-bold">How Kigali Taste runs</p>
        <p className="mt-1 text-muted-foreground">
          Customers pay menu + your markup + delivery. Vendors get menu base prices after delivery. You keep markup and
          delivery commission. Approve vendors, set markup, deliver orders, then manage payouts.
        </p>
      </AdminGuide>

      <div className="grid gap-5 lg:grid-cols-3">
        <BalanceCard
          label="Platform earnings"
          value={frw(d.earned || 0)}
          hint={`Available ${frw(d.platformWallet)} · markup ${frw(d.markupEarned || 0)} + delivery ${frw(d.deliveryEarned || 0)}${d.pendingEarnings ? ` · pending ${frw(d.pendingEarnings)}` : ""}`}
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:col-span-2">
          <StatCard label="Today's orders" value={String(todayOrders)} pct={Math.min(100, todayOrders * 10 + 20)} />
          <StatCard
            label="Ready to deliver"
            value={String(deliveryQueue)}
            pct={Math.min(100, deliveryQueue * 20 + 10)}
            gold
          />
          <StatCard label="Live restaurants" value={String(liveRestaurants)} pct={Math.min(100, liveRestaurants * 20 + 40)} />
          <StatCard
            label="Pending vendors"
            value={String(pendingVendors)}
            pct={Math.min(100, pendingVendors * 25 + 10)}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AdminMetric label="Active orders" value={String(activeOrders)} hint={`${totalOrders} total orders`} />
        <AdminMetric label="Awaiting payment" value={String(awaitingPayment)} hint="Not paid yet" />
        <AdminMetric label="Customers" value={String(totalCustomers)} hint="Registered accounts" />
        <AdminMetric
          label="Newsletter"
          value={String(newsletterSubscribers)}
          hint="Homepage email signups"
        />
        <AdminMetric
          label="Payments"
          value={d.paymentsReady ? "Live" : "Offline"}
          hint={d.paymentsReady ? "XentriPay configured" : "Add XENTRIPAY_API_KEY in backend/.env"}
        />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-extrabold text-[#0d4f46]">Quick actions</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <QuickLink href="/admin/vendors" label="Approve vendors" hint={`${pendingVendors} waiting for review`} />
          <QuickLink href="/admin/delivery" label="Deliver orders" hint={`${deliveryQueue} in delivery queue`} />
          <QuickLink href="/admin/newsletter" label="Newsletter list" hint={`${newsletterSubscribers} email signup${newsletterSubscribers === 1 ? "" : "s"}`} />
          <QuickLink href="/admin/hero" label="Edit homepage hero" hint="Headline, photos, buttons and feature bar" />
          <QuickLink href="/admin/about" label="Edit About page" hint="Hero, stats, pricing and partner sections" />
          <QuickLink href="/admin/reviews" label="Manage reviews" hint="Edit, hide or remove customer ratings" />
          <QuickLink href="/admin/restaurants" label="All restaurants" hint={`${liveRestaurants}/${totalRestaurants} live on site`} />
          <QuickLink href="/admin/wallet" label="Wallet & payouts" hint={`${frw(d.platformWallet)} available to send`} />
          <QuickLink href="/admin/transactions" label="Transactions" hint="Markup, delivery and payout history" />
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold text-[#0d4f46]">Recent orders</h2>
          <Link href="/admin/orders" className="text-sm font-semibold text-[#0d4f46] underline">
            View all
          </Link>
        </div>
        {recentOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No orders yet.</p>
        ) : (
          <div className="space-y-2">
            {recentOrders.map((order) => (
              <div
                key={order.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-card"
              >
                <div className="min-w-0">
                  <p className="font-bold">
                    {order.orderNumber} · {order.restaurantName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {order.customerName} · {frw(order.total)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusChip status={order.status} />
                  <StatusChip status={order.paymentStatus} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
