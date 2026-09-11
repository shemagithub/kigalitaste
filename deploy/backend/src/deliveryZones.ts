import { many, one, run, setting } from "./db.ts";

export type DeliveryZoneRow = {
  id: number;
  name: string;
  keywords: string;
  fee: number;
  sort: number;
  isActive: number;
};

export type DeliveryQuote = {
  fee: number;
  zoneId: number | null;
  zoneName: string | null;
  address: string;
  lat: number | null;
  lng: number | null;
  fallback: boolean;
};

export async function listDeliveryZones(activeOnly = false) {
  return many<DeliveryZoneRow>(
    `SELECT * FROM delivery_zones ${activeOnly ? "WHERE isActive = 1" : ""} ORDER BY sort, name`,
  );
}

function parseKeywords(raw: string) {
  return raw
    .split(/[,;|]/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

export function matchDeliveryZone(address: string, zones: DeliveryZoneRow[]) {
  const hay = address.toLowerCase();
  let best: DeliveryZoneRow | null = null;
  let bestLen = 0;

  for (const zone of zones) {
    if (!zone.isActive) continue;
    const terms = [zone.name, ...parseKeywords(zone.keywords)];
    for (const term of terms) {
      const needle = term.toLowerCase().trim();
      if (!needle || needle.length < 3) continue;
      if (hay.includes(needle) && needle.length > bestLen) {
        best = zone;
        bestLen = needle.length;
      }
    }
  }

  return best;
}

export async function resolveDeliveryQuote(
  address: string,
  lat?: unknown,
  lng?: unknown,
  zoneId?: unknown,
): Promise<DeliveryQuote> {
  const clean = address.trim();
  const zones = await listDeliveryZones(true);
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  const hasCoords = Number.isFinite(parsedLat) && Number.isFinite(parsedLng);
  const parsedZoneId = Number(zoneId);

  if (Number.isFinite(parsedZoneId) && parsedZoneId > 0) {
    const picked = zones.find((z) => z.id === parsedZoneId);
    if (picked) {
      return {
        fee: Math.max(0, Number(picked.fee) || 0),
        zoneId: picked.id,
        zoneName: picked.name,
        address: clean,
        lat: hasCoords ? parsedLat : null,
        lng: hasCoords ? parsedLng : null,
        fallback: false,
      };
    }
  }

  const matched = matchDeliveryZone(clean, zones);
  const fallbackFee = Math.max(0, Number(await setting("deliveryFee", "1500")) || 1500);

  if (matched) {
    return {
      fee: Math.max(0, Number(matched.fee) || 0),
      zoneId: matched.id,
      zoneName: matched.name,
      address: clean,
      lat: hasCoords ? parsedLat : null,
      lng: hasCoords ? parsedLng : null,
      fallback: false,
    };
  }

  return {
    fee: fallbackFee,
    zoneId: null,
    zoneName: null,
    address: clean,
    lat: hasCoords ? parsedLat : null,
    lng: hasCoords ? parsedLng : null,
    fallback: true,
  };
}

export async function seedDeliveryZonesIfEmpty() {
  const count = await one<{ n: number }>("SELECT COUNT(*) AS n FROM delivery_zones");
  if (Number(count?.n ?? 0) > 0) return;

  const zones = [
    { name: "City centre", keywords: "nyarugenge,cbd,downtown,city centre,city center,muhima", fee: 1000, sort: 1 },
    { name: "Kacyiru", keywords: "kacyiru,gisozi,kinamba", fee: 1200, sort: 2 },
    { name: "Kimihurura", keywords: "kimihurura,kibagabaga,vision city", fee: 1500, sort: 3 },
    { name: "Remera", keywords: "remera,kigali heights,amahoro", fee: 1800, sort: 4 },
    { name: "Kimironko", keywords: "kimironko,gisimenti,bibare", fee: 1600, sort: 5 },
    { name: "Nyarutarama", keywords: "nyarutarama,kg 9", fee: 2000, sort: 6 },
    { name: "Gikondo", keywords: "gikondo,kanombe,masaka", fee: 2200, sort: 7 },
    { name: "Kicukiro", keywords: "kicukiro,sonatube,gatenga", fee: 2500, sort: 8 },
  ];

  for (const zone of zones) {
    await run(
      "INSERT INTO delivery_zones(name, keywords, fee, sort, isActive) VALUES(?, ?, ?, ?, 1)",
      [zone.name, zone.keywords, zone.fee, zone.sort],
    );
  }
}
