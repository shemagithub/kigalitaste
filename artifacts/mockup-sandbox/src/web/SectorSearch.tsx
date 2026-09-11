import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, MapPin, Search } from "lucide-react";
import { frw } from "@/lib/api";
import { type DeliveryZoneOption, zoneSearchTerms } from "./deliveryCheckoutUtils";
import { LineInput } from "./ui";

export type { DeliveryZoneOption };

function zoneLabel(zone: DeliveryZoneOption) {
  return `${zone.name} · ${frw(zone.fee)} delivery`;
}

export function SectorSearch({
  zones,
  zoneId,
  onPick,
  onClear,
  placeholder = "Search sector — e.g. Kimihurura, Kacyiru…",
}: {
  zones: DeliveryZoneOption[];
  zoneId: number | null;
  onPick: (zoneId: number) => void;
  onClear?: () => void;
  placeholder?: string;
}) {
  const selected = zones.find((z) => z.id === zoneId) ?? null;
  const [query, setQuery] = useState(selected ? zoneLabel(selected) : "");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected) setQuery(zoneLabel(selected));
    else if (!open) setQuery("");
  }, [zoneId, selected?.id, selected?.fee, open]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle || (selected && query === zoneLabel(selected))) {
      return zones;
    }
    return zones.filter((zone) =>
      zoneSearchTerms(zone).some((term) => term.toLowerCase().includes(needle)),
    );
  }, [query, selected, zones]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
        <LineInput
          value={query}
          onChange={(e) => {
            const next = e.target.value;
            setQuery(next);
            setOpen(true);
            if (selected && next !== zoneLabel(selected)) onClear?.();
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="pr-10 pl-10"
          autoComplete="off"
        />
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>

      {open ? (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-2xl border border-border bg-white shadow-lg">
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">No sector matches “{query.trim()}”</p>
          ) : (
            filtered.map((zone) => (
              <button
                key={zone.id}
                type="button"
                className={`flex w-full items-center gap-2 px-4 py-3 text-left text-sm hover:bg-muted/60 ${
                  zone.id === zoneId ? "bg-secondary/60 font-semibold text-primary" : ""
                }`}
                onClick={() => {
                  onPick(zone.id);
                  setQuery(zoneLabel(zone));
                  setOpen(false);
                }}
              >
                <MapPin className="h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1">{zone.name}</span>
                <span className="shrink-0 text-xs font-semibold text-muted-foreground">{frw(zone.fee)}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
