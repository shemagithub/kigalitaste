export type Settings = Record<string, string> & {
  deliveryZones?: { id: number; name: string; fee: number; keywords?: string }[];
  deliveryFrom?: number;
};

export type Restaurant = {
  id: number;
  name: string;
  slug: string;
  logoUrl: string | null;
  coverUrl: string | null;
  type: string;
  address: string;
  description?: string | null;
  openingHours?: string | null;
  isOpen?: number;
};

export type MenuItem = {
  id: number;
  name: string;
  description: string;
  imageUrl: string | null;
  price: number;
  isAvailable: boolean;
  categoryId: number;
  categoryName?: string;
  restaurantId?: number;
  restaurantName?: string;
  restaurantSlug?: string;
  restaurantType?: string;
  promoActive?: boolean;
  promoType?: string | null;
  promoBuyQty?: number;
  promoGetQty?: number;
  promoGetIds?: number[];
  promoLabel?: string | null;
};

export type CartLine = {
  lineKey: string;
  menuItemId: number;
  name: string;
  price: number;
  qty: number;
  restaurantId: number;
  restaurantName: string;
  imageUrl?: string | null;
  description?: string;
  isFree?: boolean;
  promoOfLineKey?: string;
  promoTriggerMenuItemId?: number;
};

export const CART_KEY = "kt_cart";
export const FAV_KEY = "kt_favorites";
export const CHECKOUT_KEY = "kt_checkout";

export type CheckoutDraft = {
  fulfillment: "DELIVERY" | "PICKUP";
  address: string;
  deliveryLat: number | null;
  deliveryLng: number | null;
  deliveryFee: number;
  deliveryZoneId: number | null;
  deliveryZoneName: string | null;
  phone: string;
  notes: string;
  promo: string;
};

const emptyCheckout = (): CheckoutDraft => ({
  fulfillment: "DELIVERY",
  address: "Kacyiru, Kigali",
  deliveryLat: null,
  deliveryLng: null,
  deliveryFee: 1500,
  deliveryZoneId: null,
  deliveryZoneName: null,
  phone: "",
  notes: "",
  promo: "",
});

export function loadCheckout(): CheckoutDraft {
  try {
    const raw = sessionStorage.getItem(CHECKOUT_KEY);
    if (!raw) return emptyCheckout();
    return { ...emptyCheckout(), ...JSON.parse(raw) };
  } catch {
    return emptyCheckout();
  }
}

export function saveCheckout(draft: CheckoutDraft) {
  sessionStorage.setItem(CHECKOUT_KEY, JSON.stringify(draft));
}

export function clearCheckout() {
  sessionStorage.removeItem(CHECKOUT_KEY);
}

export function newLineKey() {
  return `l_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function isBogoItem(item: MenuItem | null | undefined) {
  return Boolean(item?.promoActive && String(item.promoType || "").toUpperCase() === "BOGO");
}

export function bogoLabelFor(item: MenuItem) {
  if (item.promoLabel) return item.promoLabel;
  const buy = Math.max(1, Number(item.promoBuyQty) || 1);
  const get = Math.max(1, Number(item.promoGetQty) || 1);
  return buy === 1 && get === 1 ? "Buy 1 Get 1" : `Buy ${buy} Get ${get}`;
}

export function normalizeCartLine(raw: Partial<CartLine> & { menuItemId: number }): CartLine {
  const isFree = Boolean(raw.isFree);
  return {
    lineKey: raw.lineKey || `legacy_${raw.menuItemId}_${isFree ? "free" : "paid"}`,
    menuItemId: Number(raw.menuItemId),
    name: String(raw.name || "Item"),
    price: isFree ? 0 : Number(raw.price) || 0,
    qty: Math.max(1, Number(raw.qty) || 1),
    restaurantId: Number(raw.restaurantId) || 0,
    restaurantName: String(raw.restaurantName || ""),
    imageUrl: raw.imageUrl,
    description: raw.description,
    isFree,
    promoOfLineKey: raw.promoOfLineKey,
    promoTriggerMenuItemId: raw.promoTriggerMenuItemId ? Number(raw.promoTriggerMenuItemId) : undefined,
  };
}

export function loadCart(): CartLine[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((line) => line && line.qty > 0).map((line) => normalizeCartLine(line))
      : [];
  } catch {
    return [];
  }
}

export function saveCart(cart: CartLine[]) {
  const next = cart.filter((line) => line.qty > 0).map((line) => normalizeCartLine(line));
  if (next.length === 0) localStorage.removeItem(CART_KEY);
  else localStorage.setItem(CART_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("kt-cart"));
}

export function emptyCart() {
  localStorage.removeItem(CART_KEY);
  window.dispatchEvent(new Event("kt-cart"));
}

export function loadFavs(): number[] {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveFavs(ids: number[]) {
  localStorage.setItem(FAV_KEY, JSON.stringify(ids));
}

export function cartCheckoutItems(cart: CartLine[]) {
  return cart.map((l) => ({
    menuItemId: l.menuItemId,
    qty: l.qty,
    isFree: Boolean(l.isFree),
    promoTriggerMenuItemId: l.isFree ? l.promoTriggerMenuItemId || l.menuItemId : undefined,
  }));
}

/** Add a paid dish. Returns null if user cancels restaurant replace. */
export function addPaidToCart(
  cart: CartLine[],
  item: MenuItem,
  restaurant: { id: number; name: string },
  qty = 1,
): { cart: CartLine[]; paidLineKey: string } | null {
  const addQty = Math.max(1, qty);
  if (cart.length && cart[0].restaurantId !== restaurant.id) {
    if (!confirm("Your cart has items from another restaurant. Replace it?")) return null;
    const paidLineKey = newLineKey();
    return {
      paidLineKey,
      cart: [
        normalizeCartLine({
          lineKey: paidLineKey,
          menuItemId: item.id,
          name: item.name,
          price: Number(item.price) || 0,
          qty: addQty,
          restaurantId: restaurant.id,
          restaurantName: restaurant.name,
          imageUrl: item.imageUrl,
          description: item.description,
          isFree: false,
        }),
      ],
    };
  }

  const existing = cart.find((l) => !l.isFree && l.menuItemId === item.id);
  if (existing) {
    return {
      paidLineKey: existing.lineKey,
      cart: cart.map((l) =>
        l.lineKey === existing.lineKey
          ? {
              ...l,
              qty: l.qty + addQty,
              name: item.name,
              price: Number(item.price) || 0,
              imageUrl: item.imageUrl || l.imageUrl,
              description: item.description || l.description,
            }
          : l,
      ),
    };
  }

  const paidLineKey = newLineKey();
  return {
    paidLineKey,
    cart: [
      ...cart,
      normalizeCartLine({
        lineKey: paidLineKey,
        menuItemId: item.id,
        name: item.name,
        price: Number(item.price) || 0,
        qty: addQty,
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        imageUrl: item.imageUrl,
        description: item.description,
        isFree: false,
      }),
    ],
  };
}

/** @deprecated use addPaidToCart + free picker for BOGO */
export function addToCart(
  cart: CartLine[],
  item: MenuItem,
  restaurant: { id: number; name: string },
): CartLine[] | null {
  const result = addPaidToCart(cart, item, restaurant, 1);
  return result ? result.cart : null;
}

export function freeChoicesFor(item: MenuItem, catalogItems: MenuItem[]): MenuItem[] {
  const ids = (item.promoGetIds || []).map(Number).filter((n) => n > 0);
  const sameRestaurant = catalogItems.filter(
    (i) =>
      i.isAvailable !== false &&
      (i.restaurantId == null || item.restaurantId == null || i.restaurantId === item.restaurantId),
  );
  if (ids.length === 0) {
    const self = sameRestaurant.find((i) => i.id === item.id) || item;
    return [self];
  }
  return ids
    .map((id) => sameRestaurant.find((i) => i.id === id))
    .filter((i): i is MenuItem => Boolean(i));
}

export function addFreePromoLines(
  cart: CartLine[],
  paidLineKey: string,
  triggerItem: MenuItem,
  freeItem: MenuItem,
  restaurant: { id: number; name: string },
  freeQty: number,
): CartLine[] {
  const qty = Math.max(1, freeQty);
  const paid = cart.find((l) => l.lineKey === paidLineKey && !l.isFree);
  if (!paid) return cart;

  const existingFree = cart.find(
    (l) =>
      l.isFree &&
      l.promoOfLineKey === paidLineKey &&
      l.menuItemId === freeItem.id &&
      l.promoTriggerMenuItemId === triggerItem.id,
  );
  if (existingFree) {
    return cart.map((l) => (l.lineKey === existingFree.lineKey ? { ...l, qty: l.qty + qty, price: 0 } : l));
  }

  return [
    ...cart,
    normalizeCartLine({
      lineKey: newLineKey(),
      menuItemId: freeItem.id,
      name: freeItem.name,
      price: 0,
      qty,
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      imageUrl: freeItem.imageUrl,
      description: freeItem.description,
      isFree: true,
      promoOfLineKey: paidLineKey,
      promoTriggerMenuItemId: triggerItem.id,
    }),
  ];
}

export function removeCartLine(cart: CartLine[], lineKey: string): CartLine[] {
  const target = cart.find((l) => l.lineKey === lineKey);
  if (!target) return cart;
  if (!target.isFree) {
    return cart.filter((l) => l.lineKey !== lineKey && l.promoOfLineKey !== lineKey);
  }
  return cart.filter((l) => l.lineKey !== lineKey);
}

export function setCartLineQty(cart: CartLine[], lineKey: string, qty: number): CartLine[] {
  if (qty < 1) return removeCartLine(cart, lineKey);
  return cart.map((l) => (l.lineKey === lineKey ? { ...l, qty } : l));
}

export function syncCartWithCatalog(cart: CartLine[], items: MenuItem[]): CartLine[] {
  return cart.flatMap((line) => {
    const item = items.find((i) => i.id === line.menuItemId);
    if (!item || item.isAvailable === false) return [];
    return [
      normalizeCartLine({
        ...line,
        name: item.name,
        price: line.isFree ? 0 : Number(item.price) || 0,
        imageUrl: item.imageUrl,
        description: item.description,
        restaurantName: item.restaurantName || line.restaurantName,
      }),
    ];
  });
}

export function cartNeedsSync(prev: CartLine[], next: CartLine[]) {
  if (prev.length !== next.length) return true;
  return next.some(
    (line, i) =>
      line.lineKey !== prev[i].lineKey ||
      line.price !== prev[i].price ||
      line.name !== prev[i].name ||
      line.imageUrl !== prev[i].imageUrl ||
      line.description !== prev[i].description ||
      line.restaurantName !== prev[i].restaurantName ||
      Boolean(line.isFree) !== Boolean(prev[i].isFree),
  );
}

export const CATEGORY_LOOKS: { key: string; label: string; match: RegExp; photo: string }[] = [
  {
    key: "pizza",
    label: "Pizza",
    match: /pizza/i,
    photo: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80",
  },
  {
    key: "burger",
    label: "Burgers",
    match: /burger|brochette|grill/i,
    photo: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80",
  },
  {
    key: "chicken",
    label: "Chicken",
    match: /chicken|wings|broiler/i,
    photo: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=600&q=80",
  },
  {
    key: "rice",
    label: "Rice & plates",
    match: /rice|plate|biryani|pilau/i,
    photo: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=600&q=80",
  },
  {
    key: "drinks",
    label: "Drinks",
    match: /drink|juice|soda|tea|coffee|water/i,
    photo: "https://images.unsplash.com/photo-1544145945-f904253e096d?auto=format&fit=crop&w=600&q=80",
  },
];

export function categoriesFromItems(items: MenuItem[]) {
  return CATEGORY_LOOKS.flatMap((look) => {
    const count = items.filter((i) => look.match.test(`${i.name} ${i.categoryName || ""}`)).length;
    return count > 0 ? [{ ...look, count }] : [];
  });
}
