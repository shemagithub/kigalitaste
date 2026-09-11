import { useState } from "react";
import { Gift } from "lucide-react";
import { frw, img } from "@/lib/api";
import { Btn, useBodyScrollLock } from "./ui";
import {
  addFreePromoLines,
  addPaidToCart,
  bogoLabelFor,
  freeChoicesFor,
  isBogoItem,
  type CartLine,
  type MenuItem,
} from "./customer";

export function BogoPickModal({
  open,
  trigger,
  choices,
  getQty,
  onPick,
  onSkip,
}: {
  open: boolean;
  trigger: MenuItem;
  choices: MenuItem[];
  getQty: number;
  onPick: (freeItem: MenuItem) => void;
  onSkip: () => void;
}) {
  useBodyScrollLock(open);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = choices.find((c) => c.id === (selectedId ?? choices[0]?.id)) || choices[0] || null;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bogo-title"
        className="w-full max-w-md overflow-hidden rounded-[1.75rem] bg-white shadow-2xl"
      >
        <div className="bg-[linear-gradient(135deg,#0d4f46,#0a3d36)] px-5 py-4 text-white">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/70">
            <Gift className="h-4 w-4 text-[#e8c547]" />
            {bogoLabelFor(trigger)}
          </p>
          <h2 id="bogo-title" className="mt-1 text-xl font-extrabold">
            Pick your free dish
          </h2>
          <p className="mt-1 text-sm text-white/75">
            You added <span className="font-semibold text-white">{trigger.name}</span>. Choose{" "}
            {getQty > 1 ? `${getQty} free dishes` : "1 free dish"} included with this promo.
          </p>
        </div>
        <div className="max-h-[50vh] space-y-2 overflow-y-auto p-4">
          {choices.map((choice) => {
            const active = selected?.id === choice.id;
            return (
              <button
                key={choice.id}
                type="button"
                onClick={() => setSelectedId(choice.id)}
                className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition ${
                  active ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:bg-muted/40"
                }`}
              >
                <img src={img(choice.imageUrl)} alt="" className="h-14 w-14 rounded-xl object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{choice.name}</p>
                  <p className="line-clamp-1 text-xs text-muted-foreground">
                    {choice.description || "Free with your promo"}
                  </p>
                  <p className="mt-0.5 text-xs font-bold text-primary">FREE</p>
                </div>
                <span
                  className={`h-5 w-5 shrink-0 rounded-full border-2 ${
                    active ? "border-primary bg-primary" : "border-muted-foreground/30"
                  }`}
                />
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2 border-t border-border p-4">
          <Btn
            className="flex-1"
            disabled={!selected}
            onClick={() => {
              if (selected) onPick(selected);
            }}
          >
            Add free {selected ? selected.name : "dish"}
          </Btn>
          <Btn variant="ghost" onClick={onSkip}>
            Skip for now
          </Btn>
        </div>
      </div>
    </div>
  );
}

type PendingBogo = {
  trigger: MenuItem;
  paidLineKey: string;
  restaurant: { id: number; name: string };
  getQty: number;
  choices: MenuItem[];
  cartAfterPaid: CartLine[];
};

/** Shared add-to-cart that opens BOGO free-item picker when needed. */
export function useBogoAdd(opts: {
  cart: CartLine[];
  onCart: (cart: CartLine[]) => void;
  catalogItems: MenuItem[];
  onAdded?: (item: MenuItem) => void;
}) {
  const [pending, setPending] = useState<PendingBogo | null>(null);

  function addDish(item: MenuItem, restaurant: { id: number; name: string }, qty = 1) {
    const addQty = Math.max(1, qty);
    const result = addPaidToCart(opts.cart, item, restaurant, addQty);
    if (!result) return;
    opts.onCart(result.cart);
    opts.onAdded?.(item);

    if (!isBogoItem(item)) return;

    const choices = freeChoicesFor(item, opts.catalogItems);
    const buyQty = Math.max(1, Number(item.promoBuyQty) || 1);
    const getEach = Math.max(1, Number(item.promoGetQty) || 1);
    const getQty = Math.floor(addQty / buyQty) * getEach;
    if (choices.length === 0 || getQty < 1) return;

    setPending({
      trigger: item,
      paidLineKey: result.paidLineKey,
      restaurant,
      getQty,
      choices,
      cartAfterPaid: result.cart,
    });
  }

  const bogoModal = pending ? (
    <BogoPickModal
      open
      trigger={pending.trigger}
      choices={pending.choices}
      getQty={pending.getQty}
      onSkip={() => setPending(null)}
      onPick={(freeItem) => {
        opts.onCart(
          addFreePromoLines(
            pending.cartAfterPaid,
            pending.paidLineKey,
            pending.trigger,
            freeItem,
            pending.restaurant,
            pending.getQty,
          ),
        );
        setPending(null);
      }}
    />
  ) : null;

  return { addDish, bogoModal };
}

export function DishPromoBadge({ item }: { item: MenuItem }) {
  if (!isBogoItem(item)) return null;
  return (
    <span className="absolute left-3 top-3 z-[1] rounded-full bg-[#0d4f46] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-md sm:text-[11px]">
      {bogoLabelFor(item)}
    </span>
  );
}

export function freePriceLabel(line: CartLine) {
  if (line.isFree) return "Free";
  return frw(line.price * line.qty);
}
