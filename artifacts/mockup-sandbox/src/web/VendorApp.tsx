import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { api, frw, img, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Btn, Card, Empty, Field, GhostBtn, ImagePicker, Input, LineFile, Textarea } from "./ui";
import { bumpCatalog } from "./catalog";
import { BalanceCard, PanelShell, StatCard } from "./PanelShell";
import { PayoutsPage } from "./Payouts";
import { TransactionsPage } from "./Transactions";

type Shop = {
  vendor: { id: number; status: string; businessName: string; suspended: number };
  restaurant: {
    id: number;
    name: string;
    phone: string;
    address: string;
    description: string;
    openingHours: string;
    isLive: number;
    isOpen: number;
    type: string;
    logoUrl: string | null;
    coverUrl: string | null;
  } | null;
};

const VENDOR_NAV = [
  ["dashboard", "Dashboard"],
  ["shop", "Shop"],
  ["menu", "Menu"],
  ["orders", "Orders"],
  ["wallet", "Wallet"],
  ["transactions", "Transactions"],
];

const VENDOR_PAGES = VENDOR_NAV.map(([id]) => id);

export function VendorApp() {
  const [loc, setLoc] = useLocation();
  const { user, logout, ready } = useAuth();
  const path = (loc.split("?")[0] || "/vendor").replace(/\/$/, "") || "/vendor";
  const slug = path.replace(/^\/vendor\/?/, "") || "dashboard";
  const tab = VENDOR_PAGES.includes(slug) ? slug : "dashboard";

  useEffect(() => {
    if (!ready || path === "/vendor/login") return;
    if (path === "/vendor" || !VENDOR_PAGES.includes(slug)) {
      setLoc("/vendor/dashboard");
    }
  }, [ready, path, slug, setLoc]);

  if (!ready) return null;
  if (path === "/vendor/login" || !user || user.role !== "vendor") {
    return <VendorLogin onDone={() => setLoc("/vendor/dashboard")} />;
  }

  return (
    <PanelShell
      title="Vendor"
      basePath="/vendor"
      nav={VENDOR_NAV}
      tab={tab}
      onLogout={() => {
        logout();
        setLoc("/vendor/login");
      }}
    >
      {tab === "dashboard" && <Dash />}
      {tab === "shop" && <Shop />}
      {tab === "menu" && <Menu />}
      {tab === "orders" && <Orders />}
      {tab === "wallet" && <PayoutsPage role="vendor" />}
      {tab === "transactions" && <TransactionsPage role="vendor" />}
    </PanelShell>
  );
}

function VendorLogin({ onDone }: { onDone: () => void }) {
  const { login } = useAuth();
  const [, setLoc] = useLocation();
  const [email, setEmail] = useState("vendor@kigalitaste.rw");
  const [password, setPassword] = useState("vendor123");
  const [reject, setReject] = useState("");
  const [idFile, setIdFile] = useState<File | null>(null);
  const [rdbFile, setRdbFile] = useState<File | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await login(email, password);
      toast.success("Welcome");
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.payload.needsVerification) {
        const verifyEmail = String(err.payload.email || email);
        toast.message("Verify your email to continue");
        setLoc(`/verify-email?email=${encodeURIComponent(verifyEmail)}`);
        return;
      }
      const msg = (err as Error).message;
      setReject(msg);
      toast.error(msg);
    }
  }

  async function reupload(e: React.FormEvent) {
    e.preventDefault();
    const data = new FormData();
    if (idFile) data.append("nationalId", idFile);
    if (rdbFile) data.append("rdbCertificate", rdbFile);
    try {
      await api("/api/partners/reupload", { method: "POST", form: data });
      toast.success("Documents sent. Wait for admin approval.");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="panel flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md space-y-4">
        <h1 className="text-2xl font-extrabold">Vendor login</h1>
        <form className="space-y-3" onSubmit={(e) => void submit(e)}>
          <Field label="Email">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Btn className="w-full" type="submit">
            Log in
          </Btn>
        </form>
        <Link href="/forgot-password" className="text-sm text-primary">
          Forgot password?
        </Link>
        {reject && (
          <form className="space-y-2 border-t pt-4" onSubmit={(e) => void reupload(e)}>
            <p className="text-sm text-destructive">{reject}</p>
            <p className="text-sm">If you were rejected, upload new documents. You can preview them before sending.</p>
            <LineFile
              label="National ID (image or PDF)"
              file={idFile}
              accept="image/*,.pdf"
              onChange={setIdFile}
            />
            <LineFile
              label="RDB certificate (image or PDF)"
              file={rdbFile}
              accept="image/*,.pdf"
              onChange={setRdbFile}
            />
            <Btn type="submit">Re-upload</Btn>
          </form>
        )}
        <Link href="/" className="text-sm text-primary">
          Back to site
        </Link>
      </Card>
    </div>
  );
}

function Dash() {
  const [data, setData] = useState<{
    todayCount: number;
    pending: number;
    wallet: number;
    earned: number;
    paidToYou?: number;
    paidOut: number;
    pendingEarnings?: number;
    restaurant: { isLive: number; name: string } | null;
  } | null>(null);
  useEffect(() => {
    api<NonNullable<typeof data>>("/api/vendor/dashboard")
      .then(setData)
      .catch((e) => toast.error(e.message));
  }, []);
  if (!data) return <p>Loading…</p>;
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <BalanceCard
        label="Paid to you"
        value={frw(data.paidToYou ?? data.wallet)}
        hint={`Credited ${frw(data.earned ?? data.wallet)} from delivered orders${data.pendingEarnings ? ` · pending ${frw(data.pendingEarnings)}` : ""}${data.restaurant?.name ? ` · ${data.restaurant.name}` : ""}`}
      />
      <div className="grid gap-5 sm:grid-cols-2 lg:col-span-2">
        <StatCard label="Today’s orders" value={String(data.todayCount)} pct={Math.min(100, data.todayCount * 12)} />
        <StatCard label="Pending kitchen" value={String(data.pending)} pct={Math.min(100, data.pending * 15)} gold />
        <StatCard label="Paid out" value={frw(data.paidOut || 0)} pct={data.earned ? Math.min(100, Math.round(((data.paidOut || 0) / data.earned) * 100)) : 10} />
        <StatCard
          label="Shop"
          value={data.restaurant?.isLive ? "Live" : "Offline"}
          pct={data.restaurant?.isLive ? 100 : 20}
        />
      </div>
    </div>
  );
}

function Shop() {
  const [shop, setShop] = useState<Shop | null>(null);
  useEffect(() => {
    api<Shop>("/api/vendor/shop").then(setShop).catch((e) => toast.error(e.message));
  }, []);
  if (!shop?.restaurant) return <Empty title="Shop not ready" body="Wait until admin approves you." />;
  const r = shop.restaurant;

  async function save(patch: Record<string, unknown>) {
    try {
      const data = await api<{ restaurant: Shop["restaurant"] }>("/api/vendor/shop", {
        method: "PUT",
        json: { ...r, ...patch },
      });
      setShop({ ...shop!, restaurant: data.restaurant });
      bumpCatalog();
      toast.success("Saved");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function upload(kind: string, file: File) {
    const form = new FormData();
    form.append("file", file);
    form.append("kind", kind);
    const data = await api<{ url: string }>("/api/vendor/shop/image", { method: "POST", form });
    setShop({
      ...shop!,
      restaurant: { ...r, [kind === "cover" ? "coverUrl" : "logoUrl"]: data.url } as Shop["restaurant"],
    });
    bumpCatalog();
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="space-y-4">
      <div className="flex gap-4">
        <img src={img(r.logoUrl)} alt="" className="h-20 w-20 rounded-2xl object-cover" />
        <img src={img(r.coverUrl)} alt="" className="h-20 flex-1 rounded-2xl object-cover" />
      </div>
      <ShopImageField
        label="Logo"
        existingUrl={r.logoUrl}
        onFile={(f) => void upload("logo", f)}
        onUrl={(url) => void save({ logoUrl: url })}
      />
      <ShopImageField
        label="Cover"
        existingUrl={r.coverUrl}
        onFile={(f) => void upload("cover", f)}
        onUrl={(url) => void save({ coverUrl: url })}
      />
      <Field label="Name">
        <Input defaultValue={r.name} onBlur={(e) => void save({ name: e.target.value })} />
      </Field>
      <p className="text-sm text-muted-foreground">Kitchen contact — customers see this on your page.</p>
      <Field label="Phone">
        <Input defaultValue={r.phone} placeholder="078xxxxxxx" onBlur={(e) => void save({ phone: e.target.value })} />
      </Field>
      <Field label="Address">
        <Input defaultValue={r.address} placeholder="Street, Kigali" onBlur={(e) => void save({ address: e.target.value })} />
      </Field>
      <Field label="Description">
        <Textarea defaultValue={r.description} onBlur={(e) => void save({ description: e.target.value })} />
      </Field>
      <Field label="Opening hours">
        <Input defaultValue={r.openingHours} onBlur={(e) => void save({ openingHours: e.target.value })} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={Boolean(r.isOpen)}
          onChange={(e) => void save({ isOpen: e.target.checked })}
        />
        Open now
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={Boolean(r.isLive)}
          onChange={(e) => void save({ isLive: e.target.checked })}
        />
        Live on customer site (needs at least 1 menu item)
      </label>
      </Card>
    </div>
  );
}

function ShopImageField({
  label,
  existingUrl,
  onFile,
  onUrl,
}: {
  label: string;
  existingUrl: string | null;
  onFile: (file: File) => Promise<void> | void;
  onUrl: (url: string) => Promise<void> | void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState(existingUrl || "");
  return (
    <ImagePicker
      label={label}
      file={file}
      url={url}
      existingUrl={existingUrl}
      onFile={(next) => {
        setFile(next);
        if (next) void Promise.resolve(onFile(next)).catch((e) => toast.error((e as Error).message));
      }}
      onUrl={setUrl}
      onCommitUrl={(value) => {
        if (!/^https?:\/\//i.test(value)) {
          toast.error("Image address must start with http:// or https://");
          return;
        }
        void Promise.resolve(onUrl(value)).catch((e) => toast.error((e as Error).message));
      }}
    />
  );
}

function Menu() {
  const [cats, setCats] = useState<{ id: number; name: string }[]>([]);
  const [items, setItems] = useState<
    {
      id: number;
      name: string;
      description: string;
      basePrice: number;
      isAvailable: boolean;
      categoryId: number;
      imageUrl: string | null;
      promoActive?: boolean;
      promoGetIds?: number[];
      promoLabel?: string | null;
    }[]
  >([]);
  const [composer, setComposer] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("10000");
  const [cat, setCat] = useState("");
  const [newMenuName, setNewMenuName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [renameId, setRenameId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [promoActive, setPromoActive] = useState(false);
  const [promoGetIds, setPromoGetIds] = useState<number[]>([]);

  async function reload() {
    const data = await api<{ categories: typeof cats; items: typeof items }>("/api/vendor/menu");
    setCats(data.categories);
    setItems(data.items);
    if (data.categories[0] && !cat) setCat(String(data.categories[0].id));
  }
  useEffect(() => {
    reload().catch((e) => toast.error(e.message));
  }, []);

  function resetForm() {
    setEditingId(null);
    setName("");
    setDescription("");
    setPrice("10000");
    setFile(null);
    setImageUrl("");
    setNewMenuName("");
    setPromoActive(false);
    setPromoGetIds([]);
  }

  function openCreate() {
    resetForm();
    setComposer(true);
  }

  function closeComposer() {
    setComposer(false);
    resetForm();
  }

  useEffect(() => {
    if (!composer) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeComposer();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [composer]);

  function openEdit(item: (typeof items)[number]) {
    setEditingId(item.id);
    setName(item.name);
    setDescription(item.description || "");
    setPrice(String(item.basePrice));
    setCat(String(item.categoryId));
    setFile(null);
    setImageUrl(item.imageUrl || "");
    setNewMenuName("");
    setPromoActive(Boolean(item.promoActive));
    setPromoGetIds((item.promoGetIds || []).map(Number));
    setComposer(true);
  }

  async function saveDish() {
    if (saving) return;
    setSaving(true);
    try {
      let categoryId = cat;
      if (newMenuName.trim()) {
        const created = await api<{ id: number }>("/api/vendor/categories", {
          method: "POST",
          json: { name: newMenuName.trim() },
        });
        categoryId = String(created.id);
        setCat(categoryId);
      }
      if (!categoryId) {
        toast.error("Create a menu or pick a category");
        return;
      }
      if (!file && imageUrl.trim() && !/^https?:\/\//i.test(imageUrl.trim())) {
        toast.error("Image address must start with http:// or https://");
        setSaving(false);
        return;
      }
      if (editingId) {
        await api(`/api/vendor/menu/${editingId}`, {
          method: "PUT",
          json: {
            name,
            description,
            basePrice: Number(price),
            categoryId: Number(categoryId),
            imageUrl: file ? undefined : imageUrl.trim(),
            promoActive,
            promoType: promoActive ? "BOGO" : null,
            promoBuyQty: 1,
            promoGetQty: 1,
            promoGetIds: promoActive ? promoGetIds : [],
          },
        });
        if (file) {
          const form = new FormData();
          form.append("image", file);
          await api(`/api/vendor/menu/${editingId}/image`, { method: "POST", form });
        }
        toast.success("Dish updated");
      } else {
        const form = new FormData();
        form.append("name", name);
        form.append("description", description);
        form.append("basePrice", price);
        form.append("categoryId", categoryId);
        form.append("promoActive", promoActive ? "1" : "0");
        form.append("promoType", promoActive ? "BOGO" : "");
        form.append("promoBuyQty", "1");
        form.append("promoGetQty", "1");
        form.append("promoGetIds", JSON.stringify(promoActive ? promoGetIds : []));
        if (file) form.append("image", file);
        if (imageUrl.trim()) form.append("imageUrl", imageUrl.trim());
        await api("/api/vendor/menu", { method: "POST", form });
        toast.success("Dish added — you will receive this amount");
      }
      resetForm();
      setComposer(false);
      await reload();
      bumpCatalog();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Menus are groups like Mains, Pizza or Drinks. Add dishes, then edit or remove them anytime.
          </p>
        </div>
        <Btn onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          Create another menu
        </Btn>
      </div>

      {composer && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 p-4 sm:items-center"
          onClick={closeComposer}
        >
          <div className="my-8 w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <Card className="space-y-4 shadow-2xl">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-bold">{editingId ? "Edit dish" : "New menu / dish"}</h2>
                <button type="button" className="rounded-full p-1 text-muted-foreground hover:bg-muted" onClick={closeComposer} aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {!editingId && (
                <Field label="New menu name (optional)">
                  <Input
                    value={newMenuName}
                    onChange={(e) => setNewMenuName(e.target.value)}
                    placeholder="e.g. Lunch, Grill, Drinks"
                  />
                </Field>
              )}
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Dish name">
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Brochette" />
                </Field>
                <Field label="You will receive (FRw)">
                  <Input value={price} onChange={(e) => setPrice(e.target.value)} />
                </Field>
                <Field label={editingId || !newMenuName.trim() ? "Menu" : "Or pick an existing menu"}>
                  <select className="h-11 w-full rounded-xl border px-3" value={cat} onChange={(e) => setCat(e.target.value)}>
                    {cats.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="md:col-span-2">
                  <ImagePicker
                    label="Photo"
                    file={file}
                    url={imageUrl}
                    existingUrl={editingId ? items.find((i) => i.id === editingId)?.imageUrl : null}
                    onFile={setFile}
                    onUrl={setImageUrl}
                  />
                </div>
                <div className="md:col-span-2">
                  <Field label="Description">
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
                  </Field>
                </div>
                <div className="md:col-span-2 space-y-3 rounded-2xl border border-primary/20 bg-primary/[0.04] p-4">
                  <label className="flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={promoActive}
                      onChange={(e) => setPromoActive(e.target.checked)}
                    />
                    <span>
                      <span className="font-bold">Buy 1 Get 1 promo</span>
                      <span className="mt-0.5 block text-muted-foreground">
                        Customers see a badge on this dish and pick a free item when they add it — no coupon code.
                      </span>
                    </span>
                  </label>
                  {promoActive ? (
                    <div className="grid max-h-36 gap-2 overflow-y-auto sm:grid-cols-2">
                      {items
                        .filter((i) => i.id !== editingId)
                        .map((i) => (
                          <label key={i.id} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm">
                            <input
                              type="checkbox"
                              checked={promoGetIds.includes(i.id)}
                              onChange={(e) =>
                                setPromoGetIds((prev) =>
                                  e.target.checked ? [...prev, i.id] : prev.filter((id) => id !== i.id),
                                )
                              }
                            />
                            <span className="truncate">{i.name}</span>
                          </label>
                        ))}
                      {items.filter((i) => i.id !== editingId).length === 0 ? (
                        <p className="text-xs text-muted-foreground sm:col-span-2">
                          Leave empty to give the same dish free.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Btn disabled={saving} onClick={() => void saveDish()}>
                  {saving ? "Saving…" : editingId ? "Save changes" : "Add dish"}
                </Btn>
                <GhostBtn type="button" onClick={closeComposer}>
                  Cancel
                </GhostBtn>
              </div>
            </Card>
          </div>
        </div>
      )}

      {cats.length === 0 && !composer && (
        <Empty
          title="No menus yet"
          body="Tap Create another menu to add a group like Pizza, then your first dish."
          action={<Btn onClick={openCreate}>Create another menu</Btn>}
        />
      )}

      {cats.map((menu) => {
        const dishes = items.filter((i) => i.categoryId === menu.id);
        return (
          <Card key={menu.id} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {renameId === menu.id ? (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
                  <Btn
                    onClick={async () => {
                      await api(`/api/vendor/categories/${menu.id}`, {
                        method: "PUT",
                        json: { name: renameValue },
                      });
                      setRenameId(null);
                      await reload();
                      bumpCatalog();
                    }}
                  >
                    Save
                  </Btn>
                  <GhostBtn type="button" onClick={() => setRenameId(null)}>
                    Cancel
                  </GhostBtn>
                </div>
              ) : (
                <h2 className="text-lg font-bold">{menu.name}</h2>
              )}
              <div className="flex flex-wrap gap-2">
                <GhostBtn
                  type="button"
                  onClick={() => {
                    resetForm();
                    setCat(String(menu.id));
                    setComposer(true);
                  }}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add dish
                </GhostBtn>
                <GhostBtn
                  type="button"
                  onClick={() => {
                    setRenameId(menu.id);
                    setRenameValue(menu.name);
                  }}
                >
                  Rename
                </GhostBtn>
                <GhostBtn
                  type="button"
                  className="text-destructive"
                  onClick={async () => {
                    if (!confirm(`Delete the ${menu.name} menu? Dishes must be removed first.`)) return;
                    try {
                      await api(`/api/vendor/categories/${menu.id}`, { method: "DELETE" });
                      toast.success("Menu removed");
                      await reload();
                      bumpCatalog();
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  Delete menu
                </GhostBtn>
              </div>
            </div>
            {dishes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No dishes in this menu yet.</p>
            ) : (
              <div className="grid gap-3">
                {dishes.map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-muted/60 p-3">
                    <img src={img(item.imageUrl)} alt="" className="h-16 w-16 rounded-xl object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-sm text-muted-foreground">You will receive {frw(item.basePrice)}</p>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={item.isAvailable}
                        onChange={async (e) => {
                          await api(`/api/vendor/menu/${item.id}`, {
                            method: "PUT",
                            json: { isAvailable: e.target.checked },
                          });
                          await reload();
                          bumpCatalog();
                        }}
                      />
                      Available
                    </label>
                    <GhostBtn type="button" onClick={() => openEdit(item)}>
                      <Pencil className="mr-1 h-4 w-4" />
                      Edit
                    </GhostBtn>
                    <GhostBtn
                      type="button"
                      className="text-destructive"
                      onClick={async () => {
                        if (!confirm(`Delete ${item.name}?`)) return;
                        try {
                          await api(`/api/vendor/menu/${item.id}`, { method: "DELETE" });
                          toast.success("Dish deleted");
                          await reload();
                          bumpCatalog();
                        } catch (e) {
                          toast.error((e as Error).message);
                        }
                      }}
                    >
                      <Trash2 className="mr-1 h-4 w-4" />
                      Delete
                    </GhostBtn>
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function Orders() {
  const [orders, setOrders] = useState<
    {
      id: number;
      orderNumber: string;
      status: string;
      customerName: string;
      notes: string;
      vendorAmount: number;
      platformAmount: number;
      paymentStatus: string;
      paymentMethod: string;
      items: { name: string; qty: number }[];
    }[]
  >([]);
  async function reload() {
    setOrders(await api("/api/vendor/orders"));
  }
  useEffect(() => {
    reload().catch((e) => toast.error(e.message));
  }, []);
  const nextLabel: Record<string, string> = {
    PENDING: "Accept",
    ACCEPTED: "Start preparing",
    PREPARING: "Mark ready",
  };
  const nextStatus: Record<string, string> = {
    PENDING: "ACCEPTED",
    ACCEPTED: "PREPARING",
    PREPARING: "READY",
  };
  return (
    <div className="space-y-3">
      {orders.length === 0 && <Empty title="No orders" body="Incoming orders appear here." />}
      {orders.map((order) => (
        <Card key={order.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-bold">
              {order.orderNumber} · {order.customerName.split(" ")[0]}
            </p>
            <span className="text-sm font-semibold">{order.status}</span>
          </div>
          {order.paymentMethod !== "COD" && order.paymentStatus !== "PAID" && (
            <p className="mt-1 text-sm text-amber-700">Waiting for customer payment</p>
          )}
          <p className="text-sm text-muted-foreground">
            {order.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}
          </p>
          {order.notes && <p className="text-sm">Note: {order.notes}</p>}
          <p className="mt-1 text-sm">
            You receive {frw(order.vendorAmount)}
            {order.platformAmount > 0
              ? ` · customer paid ${frw(order.vendorAmount + order.platformAmount)} (markup & delivery go to Kigali Taste)`
              : ""}
          </p>
          {nextLabel[order.status] && (order.paymentMethod === "COD" || order.paymentStatus === "PAID") && (
            <Btn
              className="mt-3"
              onClick={async () => {
                await api(`/api/vendor/orders/${order.id}/status`, {
                  method: "POST",
                  json: { status: nextStatus[order.status] },
                });
                await reload();
              }}
            >
              {nextLabel[order.status]}
            </Btn>
          )}
        </Card>
      ))}
    </div>
  );
}

