import { useEffect, useRef } from "react";
import { api } from "@/lib/api";

export function useLiveLocation(orderId: number | null, active: boolean) {
  const lastSent = useRef(0);

  useEffect(() => {
    if (!orderId || !active || !navigator.geolocation) return;

    function send(lat: number, lng: number) {
      const now = Date.now();
      if (now - lastSent.current < 12_000) return;
      lastSent.current = now;
      void api(`/api/admin/orders/${orderId}/location`, {
        method: "POST",
        json: { lat, lng },
      }).catch(() => {
        /* ignore transient GPS upload errors */
      });
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => send(pos.coords.latitude, pos.coords.longitude),
      () => {},
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [orderId, active]);
}

export function useTrackingPoll<T>(
  orderId: number | null,
  active: boolean,
  intervalMs = 10_000,
) {
  const ref = useRef<(data: T) => void>(() => {});

  useEffect(() => {
    if (!orderId || !active) return;

    let cancelled = false;
    async function tick() {
      try {
        const data = await api<T>(`/api/orders/${orderId}/tracking`);
        if (!cancelled) ref.current(data);
      } catch {
        /* ignore poll errors */
      }
    }

    void tick();
    const id = window.setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [orderId, active, intervalMs]);

  return ref;
}
