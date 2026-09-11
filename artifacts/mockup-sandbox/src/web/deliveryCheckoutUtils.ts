export type DeliveryZoneOption = {
  id: number;
  name: string;
  fee: number;
  keywords?: string;
};

function parseKeywords(raw?: string) {
  return (raw || "")
    .split(/[,;|]/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

export function buildDeliveryAddress(street: string, zoneName: string | null, saved = "") {
  const detail = street.trim();
  const sector = zoneName?.trim();
  const built =
    detail && sector
      ? `${detail}, ${sector}, Kigali`
      : detail
        ? `${detail}, Kigali`
        : sector
          ? `${sector}, Kigali`
          : "";
  return saved.trim() || built;
}

export function matchZoneFromAddress(address: string, zones: DeliveryZoneOption[]) {
  const hay = address.toLowerCase();
  let best: DeliveryZoneOption | null = null;
  let bestLen = 0;

  for (const zone of zones) {
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

export function zoneSearchTerms(zone: DeliveryZoneOption) {
  return [zone.name, ...parseKeywords(zone.keywords)];
}
