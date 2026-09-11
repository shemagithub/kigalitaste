import { useEffect, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { api, frw } from "@/lib/api";
import { Btn, Card, Field, GhostBtn, Input } from "./ui";

export type PayoutRow = {
  id: number;
  amount: number;
  status: string;
  methodNote: string;
  ownerType?: string | null;
  msisdn?: string | null;
  recipientName?: string | null;
  customerReference?: string | null;
  adminNote?: string | null;
  businessName?: string;
  email?: string;
  xentriStatus?: string | null;
};

export type WalletData = {
  balance: number;
  available: number;
  collected: number;
  paidOut: number;
  held: number;
  earned?: number;
  paidToYou?: number;
  markupEarned?: number;
  deliveryEarned?: number;
  pendingEarnings?: number;
  pendingMarkup?: number;
  pendingDelivery?: number;
  shopName?: string;
  live?: boolean;
  paymentsReady?: boolean;
  phone?: string;
  earnings: { id: number; amount: number; type: string; note: string; createdAt?: string }[];
  payouts: PayoutRow[];
};

function providerFromPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const local = digits.startsWith("250") ? `0${digits.slice(3)}` : digits.startsWith("0") ? digits : `0${digits}`;
  return local.startsWith("072") || local.startsWith("073") ? "63514" : "63510";
}

function providerStatus(p: PayoutRow) {
  const x = String(p.xentriStatus || "").toUpperCase();
  if (x) return x;
  const s = String(p.status || "").toUpperCase();
  if (s === "PAID") return "SUCCESSFUL";
  if (s === "SENDING") return "PENDING";
  return s;
}

function statusTone(status: string) {
  const s = status.toUpperCase();
  if (s === "PAID" || s === "COMPLETED" || s === "SUCCESS" || s === "SUCCESSFUL") {
    return "bg-emerald-100 text-emerald-800";
  }
  if (s === "SENDING" || s === "PENDING" || s === "REQUESTED") return "bg-amber-100 text-amber-800";
  if (s === "FAILED" || s === "REVERSED" || s === "REJECTED") return "bg-red-100 text-red-800";
  return "bg-muted text-foreground";
}

export function PayoutsPage({ role }: { role: "vendor" | "admin" }) {
  const [data, setData] = useState<WalletData | null>(null);
  const [provider, setProvider] = useState("63510");
  const [msisdn, setMsisdn] = useState("");
  const [amount, setAmount] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [lookedUp, setLookedUp] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [withdraw, setWithdraw] = useState("");
  const [wnote, setWnote] = useState("Cash commission withdrawal");
  const [live, setLive] = useState(true);
  const [lastSend, setLastSend] = useState<{
    name: string;
    message: string;
    ref: string;
    status: string;
  } | null>(null);

  async function reload() {
    setData(await api<WalletData>(role === "admin" ? "/api/admin/wallet" : "/api/vendor/wallet"));
  }

  useEffect(() => {
    reload()
      .catch((e) => toast.error(e.message));
    api<{ configured: boolean }>("/api/payments/config")
      .then((c) => setLive(Boolean(c.configured)))
      .catch(() => setLive(true));
  }, [role]);

  useEffect(() => {
    if (role === "vendor" && data?.phone && !msisdn) setMsisdn(data.phone);
  }, [role, data?.phone]);

  function resetForm() {
    setSelectedId(null);
    setMsisdn("");
    setAmount("");
    setRecipientName("");
    setLookedUp(false);
    setConfirmed(false);
    setProvider("63510");
  }

  function fillRequest(p: PayoutRow) {
    setSelectedId(p.id);
    setMsisdn(p.msisdn || "");
    setAmount(String(p.amount));
    setRecipientName(p.recipientName || "");
    setLookedUp(false);
    setConfirmed(false);
    setProvider(providerFromPhone(p.msisdn || ""));
  }

  async function validateName() {
    if (busy) return;
    if (!msisdn.trim()) {
      toast.error("Enter the Mobile Money number first");
      return;
    }
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 100) {
      toast.error("Enter an amount of at least 100 FRw");
      return;
    }
    setBusy(true);
    try {
      const result = await api<{
        name: string;
        local: string;
        providerId: string;
        amount: number;
      }>("/api/payouts/lookup", {
        method: "POST",
        json: {
          msisdn,
          amount: Number(amount),
          telecomProviderId: provider,
        },
      });
      setMsisdn(result.local);
      setProvider(result.providerId);
      setAmount(String(result.amount));
      setRecipientName(result.name);
      setLookedUp(Boolean(result.name));
      setConfirmed(false);
      toast.success(`Registered name: ${result.name}`);
    } catch (e) {
      setLookedUp(false);
      setRecipientName("");
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmPayout() {
    if (busy) return;
    if (!lookedUp || !confirmed || !recipientName.trim()) {
      toast.error("Validate the registered name, then confirm before sending");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        amount: Number(amount),
        msisdn,
        recipientName: recipientName.trim(),
        expectedName: recipientName.trim(),
        telecomProviderId: provider,
        confirmed: true,
      };
      const res =
        role === "admin" && selectedId
          ? await api<{
              message?: string;
              validatedAccountName?: string;
              customerReference?: string;
              xentriStatus?: string;
            }>(`/api/admin/payouts/${selectedId}/pay`, {
              method: "POST",
              json: { recipientName: recipientName.trim(), expectedName: recipientName.trim() },
            })
          : await api<{
              message?: string;
              validatedAccountName?: string;
              customerReference?: string;
              xentriStatus?: string;
            }>(role === "admin" ? "/api/admin/payouts" : "/api/vendor/payouts", {
              method: "POST",
              json: payload,
            });
      setLastSend({
        name: res.validatedAccountName || recipientName.trim(),
        message:
          res.message ||
          "Payment request submitted. Confirm the OTP sent to the XentriPay business email or phone.",
        ref: res.customerReference || "",
        status: res.xentriStatus || "PENDING",
      });
      toast.success(res.message || "Payout submitted. Confirm the XentriPay OTP.");
      resetForm();
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function refreshStatus(id: number) {
    try {
      const path = role === "admin" ? `/api/admin/payouts/${id}/status` : `/api/vendor/payouts/${id}/status`;
      const res = await api<{ status: string; xentriStatus?: string; message?: string }>(path, { method: "POST" });
      const label = String(res.xentriStatus || res.status || "PENDING").toUpperCase();
      toast.success(res.message || `XentriPay status: ${label}`);
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (!data) return <p className="text-sm text-muted-foreground">Loading wallet…</p>;

  const paidToYou = data.paidToYou ?? data.available;
  const earnedDelivered = data.earned ?? data.collected;
  const network = provider === "63514" ? "Airtel Rwanda (63514)" : "MTN Mobile Money (63510)";

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-amber-200 bg-[#fff6d8] px-5 py-4 text-sm text-[#5c4b12]">
        <p className="font-bold">How payouts work</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Enter the recipient phone and the amount (minimum 100 FRw).</li>
          <li>Click <strong>Validate name</strong>. The registered MoMo name on that number fills in automatically.</li>
          <li>Check the name, tick confirm, and send.</li>
          <li>Approve the OTP sent to the XentriPay business email or phone, then refresh status.</li>
        </ol>
      </div>

      <div className="rounded-2xl border border-[#0d4f46]/15 bg-[#0d4f46]/5 px-5 py-4 text-sm text-[#0d4f46]">
        <p className="font-bold">How money is split</p>
        <p className="mt-1 text-muted-foreground">
          {role === "admin"
            ? "Customers pay menu price + your markup + delivery. Markup and delivery commission land here after the order is delivered."
            : "You only receive your menu base prices. If a customer pays 200 FRw and your menu item is 100 FRw, you get 100 FRw. Markup and delivery go to Kigali Taste."}
        </p>
      </div>

      {lastSend ? (
        <div className="rounded-2xl border border-[#0d4f46]/20 bg-[#0d4f46]/5 px-5 py-4 text-sm">
          <p className="font-bold text-[#0d4f46]">OTP pending</p>
          <p className="mt-1 text-muted-foreground">
            {lastSend.message} Registered name: <strong>{lastSend.name}</strong>
            {lastSend.ref ? ` · ${lastSend.ref}` : ""} · {lastSend.status}
          </p>
        </div>
      ) : null}

      <div className="relative overflow-hidden rounded-[1.75rem] bg-[linear-gradient(145deg,#7a1d1d,#1a0b0b)] p-6 text-white shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
              {role === "admin" ? "Platform earnings" : "Paid to you"}
            </p>
            <p className="mt-1 text-sm text-white/70">
              {(data.shopName || "Kigali Taste").toUpperCase()} · {data.live ? "live" : "offline"}
            </p>
          </div>
          <GhostBtn type="button" className="bg-white/15 text-white hover:bg-white/25" onClick={() => void reload()}>
            Refresh
          </GhostBtn>
        </div>
        <p className="mt-6 text-4xl font-extrabold tracking-tight">{frw(role === "admin" ? (data.earned ?? data.collected) : paidToYou)}</p>
        <p className="mt-1 text-sm text-white/70">
          {role === "admin"
            ? `Markup + delivery from delivered orders · available ${frw(data.available)}`
            : `In your wallet from delivered orders · menu credited ${frw(earnedDelivered)}${data.pendingEarnings ? ` · ${frw(data.pendingEarnings)} waiting on delivery` : ""}`}
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(role === "admin"
            ? [
                ["Available now", data.available],
                ["Markup earned", data.markupEarned ?? 0],
                ["Delivery commission", data.deliveryEarned ?? 0],
                ["Pending delivery", data.pendingEarnings ?? 0],
              ]
            : [
                ["Paid to you", paidToYou],
                ["Credited (delivered)", earnedDelivered],
                ["Pending delivery", data.pendingEarnings ?? 0],
                ["Paid out", data.paidOut],
              ]
          ).map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl bg-white/10 px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-white/60">{label}</p>
              <p className="mt-1 text-lg font-bold">{frw(Number(value))}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="space-y-4">
          <div>
            <h2 className="font-extrabold text-[#0d4f46]">
              {role === "admin"
                ? selectedId
                  ? "Pay a vendor request"
                  : "Withdraw markup & commission"
                : "Send your earnings"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {role === "admin"
                ? selectedId
                  ? "This sends the selected vendor payout on XentriPay."
                  : "Send your markup and delivery commission to a Mobile Money number."
                : "Paid to your MTN or Airtel number from money you earned on delivered orders."}
            </p>
          </div>
          <Field label="Provider">
            <select
              className="h-12 w-full rounded-2xl border px-3 text-sm"
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value);
                setLookedUp(false);
                setRecipientName("");
                setConfirmed(false);
              }}
            >
              <option value="63510">MTN Mobile Money (63510)</option>
              <option value="63514">Airtel Rwanda (63514)</option>
            </select>
          </Field>
          <Field label="Mobile number">
            <Input
              className="h-12 rounded-2xl"
              value={msisdn}
              placeholder="0788302208"
              onChange={(e) => {
                const next = e.target.value;
                setMsisdn(next);
                setProvider(providerFromPhone(next));
                setLookedUp(false);
                setRecipientName("");
                setConfirmed(false);
              }}
            />
          </Field>
          <p className="text-xs text-muted-foreground">Network is auto-selected: {network}.</p>
          <Field label="Amount (FRw)">
            <Input
              className="h-12 rounded-2xl"
              inputMode="numeric"
              value={amount}
              placeholder="5000"
              onChange={(e) => {
                setAmount(e.target.value);
                setLookedUp(false);
                setRecipientName("");
                setConfirmed(false);
              }}
            />
          </Field>
          <Field label="Registered MoMo name">
            <Input
              className="h-12 rounded-2xl bg-muted/30"
              value={recipientName}
              placeholder="Click Validate name to load automatically"
              readOnly
            />
          </Field>
          <GhostBtn
            type="button"
            disabled={busy || !msisdn.trim() || !amount || Number(amount) < 100}
            onClick={() => void validateName()}
          >
            {busy ? "Checking…" : "Validate name"}
          </GhostBtn>
          {lookedUp && recipientName ? (
            <p className="text-sm text-[#0d4f46]">This number is registered to {recipientName}.</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Enter the number and amount, then click validate. The registered name fills in automatically.
            </p>
          )}
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={confirmed}
              disabled={!lookedUp || !recipientName.trim()}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I confirm this is the correct number, registered name and amount.
          </label>
          <Btn className="w-full" disabled={busy || !lookedUp || !confirmed || !recipientName.trim()} onClick={() => void confirmPayout()}>
            {busy ? "Sending…" : "Confirm payout"}
          </Btn>
          {selectedId ? (
            <button type="button" className="text-xs font-semibold text-[#0d4f46] underline" onClick={resetForm}>
              Cancel vendor request and withdraw commission instead
            </button>
          ) : null}
          {live ? (
            <p className="text-xs text-muted-foreground">
              Available to send: {frw(data.available)}. Live XentriPay payouts.
            </p>
          ) : (
            <p className="text-sm text-destructive">XentriPay is not answering. Check the backend is running with backend/.env loaded.</p>
          )}
        </Card>

        <Card className="space-y-3">
          <h2 className="font-extrabold text-[#0d4f46]">Payout history</h2>
          {data.payouts.length === 0 && <p className="text-sm text-muted-foreground">No payouts yet.</p>}
          {data.payouts.map((p) => {
            const chip = providerStatus(p);
            const platform = p.ownerType === "platform";
            return (
              <div key={p.id} className="rounded-2xl border border-border px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold">{p.recipientName || p.businessName || (platform ? "Commission payout" : "Payout")}</p>
                    <p className="text-xs text-muted-foreground">
                      {platform ? "Markup / commission" : p.businessName || "Vendor earnings"}
                      {p.msisdn ? ` · ${p.msisdn}` : p.methodNote ? ` · ${p.methodNote}` : ""}
                      {p.customerReference ? ` · ${p.customerReference}` : ""}
                    </p>
                    {p.adminNote ? <p className="mt-1 text-xs text-muted-foreground">{p.adminNote}</p> : null}
                  </div>
                  <div className="text-right">
                    <p className="font-extrabold">{frw(p.amount)}</p>
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${statusTone(chip)}`}>
                      {chip}
                    </span>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {role === "admin" && (p.status === "REQUESTED" || p.status === "FAILED") && (
                    <button type="button" className="text-xs font-semibold text-[#0d4f46] underline" onClick={() => fillRequest(p)}>
                      Use in form
                    </button>
                  )}
                  {role === "admin" && p.status === "REQUESTED" && !platform && (
                    <button
                      type="button"
                      className="text-xs font-semibold text-destructive underline"
                      onClick={async () => {
                        await api(`/api/admin/payouts/${p.id}/reject`, { method: "POST", json: { adminNote: "Rejected" } });
                        await reload();
                      }}
                    >
                      Reject
                    </button>
                  )}
                  {(p.status === "SENDING" || p.status === "FAILED" || p.customerReference) &&
                    p.status !== "PAID" &&
                    p.status !== "REJECTED" && (
                      <button type="button" className="text-xs font-semibold text-[#b42318] underline" onClick={() => void refreshStatus(p.id)}>
                        Refresh status
                      </button>
                    )}
                </div>
              </div>
            );
          })}
        </Card>
      </div>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-extrabold text-[#0d4f46]">
            {role === "admin" ? "Recent movements" : "Recent restaurant earnings"}
          </h2>
          <Link
            href={role === "admin" ? "/admin/transactions" : "/vendor/transactions"}
            className="text-sm font-semibold text-[#0d4f46] underline"
          >
            View all transactions
          </Link>
        </div>
        {data.earnings.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {role === "admin"
              ? "Markup and delivery commission appear here after an order is paid and delivered."
              : "Your menu base prices appear here after an order is paid and delivered."}
          </p>
        )}
        {data.earnings.slice(0, 5).map((e) => (
          <div key={e.id} className="flex justify-between gap-3 text-sm">
            <span className="text-muted-foreground">{e.note}</span>
            <span className="font-bold">
              {e.type === "EARNING" ? "+" : "−"}
              {frw(e.amount)}
            </span>
          </div>
        ))}
      </Card>

      {role === "admin" && (
        <Card className="flex flex-wrap items-end gap-2">
          <Field label="Record a cash withdrawal">
            <Input className="h-12 rounded-2xl" value={withdraw} onChange={(e) => setWithdraw(e.target.value)} placeholder="Amount FRw" />
          </Field>
          <Field label="Note">
            <Input className="h-12 rounded-2xl" value={wnote} onChange={(e) => setWnote(e.target.value)} />
          </Field>
          <Btn
            onClick={async () => {
              await api("/api/admin/withdraw", { method: "POST", json: { amount: Number(withdraw), note: wnote } });
              toast.success("Withdrawal recorded");
              setWithdraw("");
              await reload();
            }}
          >
            Record withdrawal
          </Btn>
        </Card>
      )}
    </div>
  );
}
