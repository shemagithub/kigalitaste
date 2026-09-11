import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, frw } from "@/lib/api";
import { Btn, Card, Empty, Input } from "../ui";
import { DeliveryMap, getCurrentPosition, type DeliveryTracking } from "../DeliveryMap";
import { useLiveLocation } from "../useLiveLocation";
import { AdminGuide, StatusChip } from "./AdminUi";

type DeliveryOrder = DeliveryTracking & {
  id: number;
  orderNumber: string;
  status: string;
  customerName: string;
  customerPhone: string;
  restaurantName: string;
  total: number;
  paymentStatus: string;
};

function DeliveryCard({
  order,
  note,
  onNote,
  onReload,
}: {
  order: DeliveryOrder;
  note: string;
  onNote: (value: string) => void;
  onReload: () => Promise<void>;
}) {
  const sharing = order.status === "OUT_FOR_DELIVERY";
  useLiveLocation(order.id, sharing);

  async function startDelivery() {
    try {
      let body: { status: string; deliveryNote?: string; riderLat?: number; riderLng?: number } = {
        status: "OUT_FOR_DELIVERY",
        deliveryNote: note || undefined,
      };
      try {
        const pos = await getCurrentPosition();
        body = { ...body, riderLat: pos.lat, riderLng: pos.lng };
      } catch {
        toast.message("Starting without GPS — allow location to share live tracking");
      }
      await api(`/api/admin/orders/${order.id}/status`, { method: "POST", json: body });
      toast.success("Out for delivery — live location sharing");
      await onReload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-bold">
          {order.orderNumber} · {order.restaurantName}
        </p>
        <StatusChip status={order.status} />
        <StatusChip status={order.paymentStatus} />
      </div>
      <p className="text-sm">
        {order.customerName} · {order.customerPhone} · {frw(order.total)}
      </p>
      <p className="text-sm text-muted-foreground">{order.deliveryAddress}</p>

      <DeliveryMap tracking={order} />

      {sharing ? (
        <p className="rounded-xl bg-[#0d4f46]/5 px-3 py-2 text-xs text-[#0d4f46]">
          Live location is on while this tab is open. The customer can see your position on their order.
        </p>
      ) : null}

      <Input placeholder="Delivery note (optional)" value={note} onChange={(e) => onNote(e.target.value)} />

      {order.status === "READY" ? (
        <Btn onClick={() => void startDelivery()}>Start delivery & share location</Btn>
      ) : null}
      {order.status === "OUT_FOR_DELIVERY" ? (
        <Btn
          onClick={async () => {
            await api(`/api/admin/orders/${order.id}/status`, {
              method: "POST",
              json: { status: "DELIVERED", deliveryNote: note || undefined },
            });
            toast.success("Delivered — wallets credited");
            await onReload();
          }}
        >
          Mark delivered
        </Btn>
      ) : null}
    </Card>
  );
}

export function AdminDelivery() {
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [notes, setNotes] = useState<Record<number, string>>({});

  async function reload() {
    setOrders(await api("/api/admin/delivery"));
  }

  useEffect(() => {
    reload().catch((e) => toast.error(e.message));
    const id = window.setInterval(() => {
      void reload();
    }, 15_000);
    return () => window.clearInterval(id);
  }, []);

  const ready = orders.filter((o) => o.status === "READY").length;
  const out = orders.filter((o) => o.status === "OUT_FOR_DELIVERY").length;

  return (
    <div className="space-y-4">
      <AdminGuide>
        <p className="font-bold">Delivery queue with live location</p>
        <p className="mt-1 text-muted-foreground">
          Start delivery to share your GPS with the customer. Keep this page open while riding — location updates every
          few seconds. Mark delivered when the food arrives.
        </p>
      </AdminGuide>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ready for pickup</p>
          <p className="mt-2 text-2xl font-extrabold text-[#0d4f46]">{ready}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Out for delivery</p>
          <p className="mt-2 text-2xl font-extrabold text-[#0d4f46]">{out}</p>
        </Card>
      </div>

      {orders.length === 0 ? (
        <Empty title="No deliveries waiting" body="When a restaurant marks READY, the order lands here." />
      ) : (
        orders.map((o) => (
          <DeliveryCard
            key={o.id}
            order={o}
            note={notes[o.id] || ""}
            onNote={(value) => setNotes((prev) => ({ ...prev, [o.id]: value }))}
            onReload={reload}
          />
        ))
      )}
    </div>
  );
}
