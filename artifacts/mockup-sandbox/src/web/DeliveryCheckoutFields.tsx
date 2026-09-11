import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, LocateFixed, MapPin, Navigation } from "lucide-react";
import { toast } from "sonner";
import { api, frw } from "@/lib/api";
import { getCurrentPosition } from "./DeliveryMap";
import { fetchDeliveryQuote, LocationSearch } from "./LocationSearch";
import { SectorSearch } from "./SectorSearch";
import { type Settings } from "./customer";
import { LineField, LineInput } from "./ui";

export type DeliveryCheckoutValue = {
  address: string;
  street: string;
  zoneId: number | null;
  zoneName: string | null;
  lat: number | null;
  lng: number | null;
  fee: number;
  fallback: boolean;
};

import { buildDeliveryAddress, matchZoneFromAddress } from "./deliveryCheckoutUtils";

export function DeliveryCheckoutFields({
  settings,
  value,
  onChange,
  onQuotingChange,
}: {
  settings: Settings;
  value: DeliveryCheckoutValue;
  onChange: (next: DeliveryCheckoutValue) => void;
  onQuotingChange?: (quoting: boolean) => void;
}) {
  const zones = useMemo(() => settings.deliveryZones || [], [settings.deliveryZones]);
  const [quoting, setQuoting] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const fullAddress = buildDeliveryAddress(value.street, value.zoneName, value.address);

  useEffect(() => {
    onQuotingChange?.(quoting);
  }, [quoting, onQuotingChange]);

  useEffect(() => {
    if (!value.zoneId && !fullAddress.trim()) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setQuoting(true);
      try {
        const quote = await fetchDeliveryQuote(
          fullAddress.trim() || `${value.zoneName}, Kigali`,
          value.lat,
          value.lng,
          value.zoneId,
        );
        if (cancelled || !quote) return;

        const nextAddress = quote.address || fullAddress.trim();
        if (
          quote.fee === value.fee &&
          quote.zoneId === value.zoneId &&
          quote.zoneName === value.zoneName &&
          nextAddress === value.address &&
          quote.fallback === value.fallback
        ) {
          return;
        }

        onChangeRef.current({
          ...value,
          address: nextAddress,
          zoneId: quote.zoneId,
          zoneName: quote.zoneName,
          fee: quote.fee,
          fallback: quote.fallback,
          lat: quote.lat ?? value.lat,
          lng: quote.lng ?? value.lng,
        });
      } catch (e) {
        if (!cancelled) toast.error((e as Error).message);
      } finally {
        if (!cancelled) setQuoting(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [value.street, value.zoneId, value.zoneName, value.lat, value.lng, fullAddress, value.fee, value.address, value.fallback]);

  function clearZone() {
    onChange({
      ...value,
      zoneId: null,
      zoneName: null,
      fallback: true,
    });
  }

  function pickZone(zoneId: number) {
    const zone = zones.find((z) => z.id === zoneId);
    onChange({
      ...value,
      zoneId: zone?.id ?? null,
      zoneName: zone?.name ?? null,
      fee: zone?.fee ?? value.fee,
      fallback: false,
    });
  }

  async function useGps() {
    setGpsLoading(true);
    try {
      const pos = await getCurrentPosition();
      const hit = await api<{ label: string; address: string; lat: number; lng: number }>(
        `/api/locations/reverse?lat=${pos.lat}&lng=${pos.lng}`,
      );
      const matched = matchZoneFromAddress(hit.address, zones);
      const streetGuess = hit.address.split(",")[0]?.trim() || value.street;
      onChange({
        ...value,
        street: streetGuess || value.street,
        zoneId: matched?.id ?? value.zoneId,
        zoneName: matched?.name ?? value.zoneName,
        lat: hit.lat,
        lng: hit.lng,
        address: hit.address,
      });
      toast.success(
        matched ? `GPS set · ${matched.name} detected` : "GPS saved — confirm your sector below",
      );
    } catch (e) {
      toast.error((e as Error).message || "Could not read GPS");
    } finally {
      setGpsLoading(false);
    }
  }

  function onSearchPick(pick: { address: string; lat: number | null; lng: number | null }) {
    const matched = matchZoneFromAddress(pick.address, zones);
    const streetGuess = pick.address.split(",")[0]?.trim() || value.street;
    onChange({
      ...value,
      street: streetGuess,
      zoneId: matched?.id ?? value.zoneId,
      zoneName: matched?.name ?? value.zoneName,
      lat: pick.lat,
      lng: pick.lng,
      address: pick.address,
    });
  }

  return (
    <div className="space-y-4 rounded-2xl border border-primary/15 bg-secondary/20 p-4">
      <div>
        <p className="text-sm font-bold">Where should we deliver?</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Choose your sector in Kigali, then add your street or building. Delivery fee depends on the area.
        </p>
      </div>

      <LineField label="Sector / area" required>
        <SectorSearch zones={zones} zoneId={value.zoneId} onPick={pickZone} onClear={clearZone} />
      </LineField>

      <LineField label="Street, building or landmark" required>
        <LineInput
          value={value.street}
          onChange={(e) => onChange({ ...value, street: e.target.value })}
          placeholder="e.g. KG 7 Ave, near MTN centre, gate B"
        />
      </LineField>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Or search / use GPS
        </p>
        <LocationSearch value={fullAddress} onChange={onSearchPick} placeholder="Search sector or street in Kigali" />
        <button
          type="button"
          className="mt-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-white px-4 py-2 text-sm font-semibold text-primary transition hover:bg-secondary disabled:opacity-60"
          onClick={() => void useGps()}
          disabled={gpsLoading}
        >
          {gpsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
          Share my live GPS location
        </button>
        {value.lat != null && value.lng != null ? (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700">
            <Navigation className="h-3.5 w-3.5" />
            GPS pinned ({value.lat.toFixed(4)}, {value.lng.toFixed(4)}) — rider can navigate to you
          </p>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">GPS is optional but helps the rider find you faster.</p>
        )}
      </div>

      <div
        className={`rounded-xl px-4 py-3 text-sm ${
          value.zoneId && !value.fallback
            ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
            : "border border-amber-200 bg-amber-50 text-amber-900"
        }`}
      >
        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            {quoting ? (
              <p className="flex items-center gap-2 font-semibold">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Calculating delivery fee…
              </p>
            ) : value.zoneName ? (
              <>
                <p className="font-bold">
                  {value.zoneName} · Delivery {frw(value.fee)}
                </p>
                <p className="mt-0.5 text-xs opacity-80">{fullAddress || "Add street details above"}</p>
              </>
            ) : (
              <>
                <p className="font-bold">Select your sector to see the delivery fee</p>
                <p className="mt-0.5 text-xs opacity-80">
                  Fees from {frw(settings.deliveryFrom ?? Number(settings.deliveryFee || 1500))} depending on area
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
