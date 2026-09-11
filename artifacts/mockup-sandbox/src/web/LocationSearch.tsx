import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { api } from "@/lib/api";
import { PillInput } from "./ui";

export type LocationPick = {
  address: string;
  lat: number | null;
  lng: number | null;
};

type SearchHit = {
  label: string;
  address: string;
  lat: number;
  lng: number;
};

export function LocationSearch({
  value,
  onChange,
  placeholder = "Search sector or street in Kigali",
  variant = "soft",
}: {
  value: string;
  onChange: (pick: LocationPick) => void;
  placeholder?: string;
  variant?: "default" | "soft" | "muted";
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const editingRef = useRef(false);

  useEffect(() => {
    if (!editingRef.current) setQuery(value);
  }, [value]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const rows = await api<SearchHit[]>(`/api/locations/search?q=${encodeURIComponent(query.trim())}`);
        if (!cancelled) setResults(rows);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      <PillInput
        value={query}
        variant={variant}
        icon={<MapPin className="h-4 w-4" />}
        placeholder={placeholder}
        onChange={(e) => {
          editingRef.current = true;
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => {
            editingRef.current = false;
          }, 150);
        }}
      />
      {open && (loading || results.length > 0) ? (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-2xl border border-border bg-white shadow-lg">
          {loading ? <p className="px-4 py-3 text-sm text-muted-foreground">Searching Kigali…</p> : null}
          {results.map((hit) => (
            <button
              key={`${hit.lat}-${hit.lng}-${hit.label}`}
              type="button"
              className="block w-full px-4 py-3 text-left text-sm hover:bg-muted/60"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                editingRef.current = false;
                setQuery(hit.address);
                setOpen(false);
                onChange({ address: hit.address, lat: hit.lat, lng: hit.lng });
              }}
            >
              {hit.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export type DeliveryQuote = {
  fee: number;
  zoneId: number | null;
  zoneName: string | null;
  address: string;
  lat: number | null;
  lng: number | null;
  fallback: boolean;
};

export async function fetchDeliveryQuote(
  address: string,
  lat?: number | null,
  lng?: number | null,
  zoneId?: number | null,
) {
  if (!address.trim() && !zoneId) return null;
  return api<DeliveryQuote>("/api/delivery/quote", {
    method: "POST",
    json: { address, lat, lng, zoneId, deliveryZoneId: zoneId },
  });
}
