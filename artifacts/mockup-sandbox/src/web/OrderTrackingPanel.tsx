import { useEffect, useState } from "react";
import { Bike } from "lucide-react";
import { api } from "@/lib/api";
import { DeliveryMap, type DeliveryTracking } from "./DeliveryMap";

export function OrderTrackingPanel({ orderId, status }: { orderId: number; status: string }) {
  const [tracking, setTracking] = useState<DeliveryTracking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const active = status === "OUT_FOR_DELIVERY";

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    async function poll() {
      try {
        const data = await api<DeliveryTracking>(`/api/orders/${orderId}/tracking`);
        if (!cancelled) {
          setTracking(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message || "Tracking unavailable");
        }
      }
    }

    void poll();
    const id = window.setInterval(poll, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [orderId, active]);

  if (!active) return null;

  return (
    <div className="mt-4 rounded-2xl border border-[#0d4f46]/15 bg-secondary/20 p-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-bold text-[#0d4f46]">
        <Bike className="h-4 w-4" />
        Live delivery tracking
      </p>
      {tracking ? (
        <DeliveryMap tracking={tracking} />
      ) : error ? (
        <p className="text-sm text-muted-foreground">{error}</p>
      ) : (
        <p className="text-sm text-muted-foreground">Loading rider location…</p>
      )}
    </div>
  );
}
