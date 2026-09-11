export type DeliveryTracking = {
  deliveryAddress: string;
  deliveryLat: number | null;
  deliveryLng: number | null;
  riderLat: number | null;
  riderLng: number | null;
  riderLocationAt: string | null;
  mapUrl?: string;
  directionsUrl?: string | null;
};

function osmEmbed(tracking: DeliveryTracking) {
  const points: { lat: number; lng: number }[] = [];
  if (tracking.riderLat != null && tracking.riderLng != null) {
    points.push({ lat: tracking.riderLat, lng: tracking.riderLng });
  }
  if (tracking.deliveryLat != null && tracking.deliveryLng != null) {
    points.push({ lat: tracking.deliveryLat, lng: tracking.deliveryLng });
  }
  if (points.length === 0) return null;

  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const pad = points.length > 1 ? 0.008 : 0.012;
  const minLat = Math.min(...lats) - pad;
  const maxLat = Math.max(...lats) + pad;
  const minLng = Math.min(...lngs) - pad;
  const maxLng = Math.max(...lngs) + pad;
  const focus = points[points.length - 1];
  return `https://www.openstreetmap.org/export/embed.html?bbox=${minLng}%2C${minLat}%2C${maxLng}%2C${maxLat}&layer=mapnik&marker=${focus.lat}%2C${focus.lng}`;
}

export function formatLocationAge(iso: string | null) {
  if (!iso) return "Not shared yet";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "Updated just now";
  if (ms < 3_600_000) return `Updated ${Math.round(ms / 60_000)} min ago`;
  return `Updated ${new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

export function DeliveryMap({
  tracking,
  showLegend = true,
}: {
  tracking: DeliveryTracking;
  showLegend?: boolean;
}) {
  const embed = osmEmbed(tracking);
  const hasRider = tracking.riderLat != null && tracking.riderLng != null;
  const hasDrop = tracking.deliveryLat != null && tracking.deliveryLng != null;

  return (
    <div className="space-y-2">
      {embed ? (
        <div className="overflow-hidden rounded-2xl border border-border shadow-card">
          <iframe
            title="Delivery map"
            src={embed}
            className="h-56 w-full border-0 sm:h-64"
            loading="lazy"
          />
        </div>
      ) : (
        <div className="rounded-2xl bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
          Map appears when the rider shares live location or the delivery address is located.
        </div>
      )}
      {showLegend ? (
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {hasRider ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#0d4f46]" />
              Rider · {formatLocationAge(tracking.riderLocationAt)}
            </span>
          ) : (
            <span>Waiting for rider GPS…</span>
          )}
          {hasDrop ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              Delivery address
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-3 text-sm">
        {tracking.mapUrl ? (
          <a className="font-semibold text-[#0d4f46] underline" href={tracking.mapUrl} target="_blank" rel="noreferrer">
            Open address in Maps
          </a>
        ) : null}
        {tracking.directionsUrl ? (
          <a
            className="font-semibold text-[#0d4f46] underline"
            href={tracking.directionsUrl}
            target="_blank"
            rel="noreferrer"
          >
            Get directions
          </a>
        ) : null}
      </div>
    </div>
  );
}

export async function getCurrentPosition() {
  if (!navigator.geolocation) {
    throw new Error("This device does not support GPS");
  }
  return new Promise<{ lat: number; lng: number }>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new Error(err.message || "Could not read GPS")),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
    );
  });
}
