import { resolveDeliveryQuote } from "./deliveryZones.ts";
import { applyPromoCode } from "./promoCodes.ts";
import { resolveCheckoutLines, type CheckoutCartLine } from "./dishPromos.ts";

export type CheckoutPreviewInput = {
  userId: number;
  restaurantId: number;
  items: CheckoutCartLine[];
  fulfillment?: string;
  deliveryAddress?: string;
  deliveryLat?: unknown;
  deliveryLng?: unknown;
  deliveryZoneId?: unknown;
  promoCode?: string;
};

export type CheckoutPreviewResult = {
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  promoCode: string | null;
  promoError: string | null;
  promoId: number | null;
  vendorAmount: number;
  platformAmount: number;
  lines: Awaited<ReturnType<typeof resolveCheckoutLines>>;
};

export async function computeCheckoutPreview(input: CheckoutPreviewInput): Promise<CheckoutPreviewResult> {
  const fulfillment = String(input.fulfillment || "DELIVERY").toUpperCase() === "PICKUP" ? "PICKUP" : "DELIVERY";
  const lines = await resolveCheckoutLines(input.restaurantId, input.items);

  const deliveryQuote =
    fulfillment === "PICKUP"
      ? null
      : await resolveDeliveryQuote(
          String(input.deliveryAddress || ""),
          input.deliveryLat,
          input.deliveryLng,
          input.deliveryZoneId,
        );
  const deliveryFee = fulfillment === "PICKUP" ? 0 : deliveryQuote!.fee;
  const vendorAmount = lines.reduce((s, l) => s + l.base * l.qty, 0);
  const markupTotal = lines.reduce((s, l) => s + l.markup * l.qty, 0);
  let platformAmount = markupTotal + deliveryFee;
  const foodSubtotal = vendorAmount + markupTotal;

  const applied = await applyPromoCode({
    code: input.promoCode,
    userId: input.userId,
    foodSubtotal,
    platformAmount,
    restaurantId: input.restaurantId,
  });

  if (applied.ok && applied.discount > 0) {
    platformAmount -= applied.discount;
  }

  return {
    subtotal: foodSubtotal,
    deliveryFee,
    discount: applied.ok ? applied.discount : 0,
    total: vendorAmount + platformAmount,
    promoCode: applied.ok ? applied.promoCode : null,
    promoError: applied.ok ? null : applied.error || "That promo code is not valid",
    promoId: applied.ok ? applied.promoId : null,
    vendorAmount,
    platformAmount,
    lines,
  };
}

/** Used when placing an order — throws-style via returning error for hard fail */
export async function resolveOrderTotals(input: CheckoutPreviewInput) {
  const preview = await computeCheckoutPreview(input);
  if (String(input.promoCode || "").trim() && preview.promoError) {
    throw new Error(preview.promoError);
  }
  return preview;
}
