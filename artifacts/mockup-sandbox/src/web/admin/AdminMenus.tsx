import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { api, frw, img } from "@/lib/api";
import { bumpCatalog } from "../catalog";
import { Btn, Card, Empty, Field, GhostBtn, ImagePicker, Input, Textarea } from "../ui";
import { AdminGuide, StatusChip } from "./AdminUi";

type RestaurantOption = {
  id: number;
  name: string;
  slug: string;
  businessName: string;
  isLive: number;
  suspended: number;
  menuCount: number;
};

type MenuItem = {
  id: number;
  name: string;
  description: string;
  basePrice: number;
  adminMarkup: number;
  customerPrice: number;
  isAvailable: boolean;
  categoryId: number;
  categoryName: string;
  imageUrl: string | null;
  promoActive?: boolean;
  promoType?: string | null;
  promoBuyQty?: number;
  promoGetQty?: number;
  promoGetIds?: number[];
  promoLabel?: string | null;
};

type Category = { id: number; name: string };

export function AdminMenus() {
  const [restaurants, setRestaurants] = useState<RestaurantOption[]>([]);
  const [rid, setRid] = useState<number | "">("");
  const [restaurant, setRestaurant] = useState<{ id: number; name: string; slug: string } | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [composer, setComposer] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [basePrice, setBasePrice] = useState("10000");
  const [markup, setMarkup] = useState("2000");
  const [cat, setCat] = useState("");
  const [newMenuName, setNewMenuName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [renameId, setRenameId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [bulkMarkup, setBulkMarkup] = useState("2000");
  const [loading, setLoading] = useState(false);
  const [promoActive, setPromoActive] = useState(false);
  const [promoGetIds, setPromoGetIds] = useState<number[]>([]);
  const [addingGroup, setAddingGroup] = useState(false);
  const [groupDraft, setGroupDraft] = useState("");
  const [savingGroup, setSavingGroup] = useState(false);
  const [wantNewGroup, setWantNewGroup] = useState(false);

  useEffect(() => {
    api<RestaurantOption[]>("/api/admin/restaurants")
      .then((rows) => {
        setRestaurants(rows);
        const params = new URLSearchParams(window.location.search);
        const preset = params.get("r");
        if (preset && rows.some((r) => r.id === Number(preset))) {
          setRid(Number(preset));
        } else if (rows[0]) {
          setRid(rows[0].id);
        }
      })
      .catch((e) => toast.error(e.message));
  }, []);

  async function loadMenu(id: number) {
    setLoading(true);
    try {
      const data = await api<{
        restaurant: { id: number; name: string; slug: string };
        categories: Category[];
        items: MenuItem[];
      }>(`/api/admin/restaurants/${id}/menu`);
      setRestaurant(data.restaurant);
      setCats(data.categories);
      setItems(data.items);
      if (data.categories[0]) {
        setCat((prev) => (prev && data.categories.some((c) => String(c.id) === prev) ? prev : String(data.categories[0].id)));
      } else {
        setCat("");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (rid) void loadMenu(Number(rid));
  }, [rid]);

  const customerPreview = useMemo(() => {
    const base = Number(basePrice) || 0;
    const m = Number(markup) || 0;
    return base + m;
  }, [basePrice, markup]);

  function resetForm() {
    setEditingId(null);
    setName("");
    setDescription("");
    setBasePrice("10000");
    setMarkup("2000");
    setFile(null);
    setImageUrl("");
    setNewMenuName("");
    setPromoActive(false);
    setPromoGetIds([]);
    setWantNewGroup(false);
  }

  function openCreate() {
    if (!rid) {
      toast.error("Pick a restaurant first");
      return;
    }
    resetForm();
    setComposer(true);
  }

  function closeComposer() {
    setComposer(false);
    resetForm();
  }

  async function createMenuGroup(rawName: string) {
    if (!rid) {
      toast.error("Pick a restaurant first");
      return null;
    }
    const name = rawName.trim();
    if (!name) {
      toast.error("Enter a menu group name, e.g. Mains or Drinks");
      return null;
    }
    const created = await api<{ id: number; name: string }>(`/api/admin/restaurants/${rid}/categories`, {
      method: "POST",
      json: { name },
    });
    setCats((prev) => (prev.some((c) => c.id === created.id) ? prev : [...prev, created]));
    setCat(String(created.id));
    setNewMenuName("");
    setWantNewGroup(false);
    setGroupDraft("");
    setAddingGroup(false);
    bumpCatalog();
    toast.success(`Menu group “${created.name}” added`);
    return created;
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

  function openEdit(item: MenuItem) {
    setEditingId(item.id);
    setName(item.name);
    setDescription(item.description || "");
    setBasePrice(String(item.basePrice));
    setMarkup(String(item.adminMarkup));
    setCat(String(item.categoryId));
    setFile(null);
    setImageUrl(item.imageUrl || "");
    setNewMenuName("");
    setPromoActive(Boolean(item.promoActive));
    setPromoGetIds((item.promoGetIds || []).map(Number));
    setComposer(true);
  }

  async function saveDish() {
    if (!rid || saving) return;
    setSaving(true);
    try {
      let categoryId = cat;
      if (newMenuName.trim()) {
        const created = await createMenuGroup(newMenuName);
        if (!created) return;
        categoryId = String(created.id);
      }
      if (!categoryId) {
        toast.error("Add a menu group first, or type a new group name");
        return;
      }
      if (!file && imageUrl.trim() && !/^https?:\/\//i.test(imageUrl.trim())) {
        toast.error("Image address must start with http:// or https://");
        return;
      }
      if (editingId) {
        await api(`/api/admin/restaurants/${rid}/menu/${editingId}`, {
          method: "PUT",
          json: {
            name,
            description,
            basePrice: Number(basePrice),
            adminMarkup: Number(markup),
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
          await api(`/api/admin/restaurants/${rid}/menu/${editingId}/image`, { method: "POST", form });
        }
        toast.success("Dish updated");
      } else {
        const form = new FormData();
        form.append("name", name);
        form.append("description", description);
        form.append("basePrice", basePrice);
        form.append("adminMarkup", markup);
        form.append("categoryId", categoryId);
        form.append("promoActive", promoActive ? "1" : "0");
        form.append("promoType", promoActive ? "BOGO" : "");
        form.append("promoBuyQty", "1");
        form.append("promoGetQty", "1");
        form.append("promoGetIds", JSON.stringify(promoActive ? promoGetIds : []));
        if (file) form.append("image", file);
        if (imageUrl.trim()) form.append("imageUrl", imageUrl.trim());
        await api(`/api/admin/restaurants/${rid}/menu`, { method: "POST", form });
        toast.success("Dish added");
      }
      closeComposer();
      await loadMenu(Number(rid));
      bumpCatalog();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const selectedMeta = restaurants.find((r) => r.id === rid);

  return (
    <div className="space-y-5">
      <AdminGuide>
        <p className="font-bold">Manage any restaurant menu</p>
        <p className="mt-1 text-muted-foreground">
          Pick a kitchen, view its menus and dishes, add or edit items, and set your markup. Vendor base price is what
          they earn; customer pays base + your markup + delivery.
        </p>
      </AdminGuide>

      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <Field label="Restaurant">
          <select
            className="h-11 w-full rounded-xl border px-3"
            value={rid}
            onChange={(e) => setRid(Number(e.target.value))}
          >
            <option value="">Pick a restaurant</option>
            {restaurants.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} · {r.menuCount} dishes{r.suspended ? " (suspended)" : ""}
              </option>
            ))}
          </select>
        </Field>
        {restaurant ? (
          <div className="flex flex-wrap gap-2">
            <Link href={`/r/${restaurant.slug}`}>
              <Btn variant="light" className="text-[#0d4f46]">
                View on site
              </Btn>
            </Link>
            <Btn
              variant="light"
              className="text-[#0d4f46]"
              onClick={() => {
                setAddingGroup(true);
                setGroupDraft("");
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Add menu group
            </Btn>
            <Btn onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add dish
            </Btn>
          </div>
        ) : null}
      </div>

      {selectedMeta && restaurant ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white px-4 py-3 shadow-card">
          <p className="font-bold text-[#0d4f46]">{restaurant.name}</p>
          {selectedMeta.isLive && !selectedMeta.suspended ? (
            <StatusChip status="LIVE" />
          ) : selectedMeta.suspended ? (
            <StatusChip status="SUSPENDED" />
          ) : (
            <StatusChip status="OFFLINE" />
          )}
          <p className="text-sm text-muted-foreground">
            {cats.length} menu groups · {items.length} dishes · {selectedMeta.businessName}
          </p>
        </div>
      ) : null}

      {addingGroup && rid ? (
        <Card className="space-y-3 p-4">
          <p className="font-bold text-[#0d4f46]">New menu group</p>
          <p className="text-sm text-muted-foreground">
            Groups dishes on the restaurant page (Pizza, Mains, Drinks…). You can add dishes after this.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Group name">
              <Input
                value={groupDraft}
                onChange={(e) => setGroupDraft(e.target.value)}
                placeholder="e.g. Pizza, Mains, Drinks"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (savingGroup) return;
                    setSavingGroup(true);
                    void createMenuGroup(groupDraft)
                      .then(async () => {
                        if (rid) await loadMenu(Number(rid));
                      })
                      .finally(() => setSavingGroup(false));
                  }
                }}
              />
            </Field>
            <Btn
              disabled={savingGroup}
              onClick={() => {
                setSavingGroup(true);
                void createMenuGroup(groupDraft)
                  .then(async () => {
                    if (rid) await loadMenu(Number(rid));
                  })
                  .finally(() => setSavingGroup(false));
              }}
            >
              {savingGroup ? "Adding…" : "Create group"}
            </Btn>
            <GhostBtn type="button" onClick={() => setAddingGroup(false)}>
              Cancel
            </GhostBtn>
          </div>
        </Card>
      ) : null}

      {rid && items.length > 0 ? (
        <Card className="flex flex-wrap items-end gap-3 p-4">
          <Field label="Apply markup to all dishes (FRw)">
            <Input value={bulkMarkup} onChange={(e) => setBulkMarkup(e.target.value)} className="max-w-[8rem]" />
          </Field>
          <Btn
            onClick={async () => {
              await api(`/api/admin/restaurants/${rid}/markup-bulk`, {
                method: "PUT",
                json: { adminMarkup: Number(bulkMarkup) },
              });
              toast.success("Markup applied to all dishes");
              await loadMenu(Number(rid));
              bumpCatalog();
            }}
          >
            Apply to all
          </Btn>
        </Card>
      ) : null}

      {!rid ? (
        <Empty title="Pick a restaurant" body="Choose a kitchen above to view and manage its menu." />
      ) : loading ? (
        <p className="text-sm text-muted-foreground">Loading menu…</p>
      ) : cats.length === 0 && !composer ? (
        <Empty
          title="No menu groups yet"
          body="Create a group first (Pizza, Mains, Drinks…), then add dishes to it."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Btn
                onClick={() => {
                  setAddingGroup(true);
                  setGroupDraft("");
                }}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Add menu group
              </Btn>
              <Btn variant="light" className="text-[#0d4f46]" onClick={openCreate}>
                Add first dish
              </Btn>
            </div>
          }
        />
      ) : null}

      {composer && rid ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 p-4 sm:items-center"
          onClick={closeComposer}
        >
          <div className="my-8 w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <Card className="space-y-4 shadow-2xl">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-bold">{editingId ? "Edit dish" : "New dish"}</h2>
                <button
                  type="button"
                  className="rounded-full p-1 text-muted-foreground hover:bg-muted"
                  onClick={closeComposer}
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Dish name">
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Margherita pizza" />
                </Field>
                <Field label="Menu group">
                  <select
                    className="h-11 w-full rounded-xl border px-3"
                    value={wantNewGroup || cats.length === 0 ? "__new__" : cat}
                    onChange={(e) => {
                      if (e.target.value === "__new__") {
                        setWantNewGroup(true);
                        setCat("");
                        return;
                      }
                      setWantNewGroup(false);
                      setNewMenuName("");
                      setCat(e.target.value);
                    }}
                  >
                    {cats.length > 0 && !wantNewGroup ? (
                      <option value="">Select a menu group</option>
                    ) : null}
                    {cats.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                    <option value="__new__">+ Create new menu group</option>
                  </select>
                </Field>
                {(cats.length === 0 || wantNewGroup) && (
                  <div className="md:col-span-2 flex flex-wrap items-end gap-2">
                    <Field label={cats.length === 0 ? "New menu group (required)" : "New menu group name"}>
                      <Input
                        value={newMenuName}
                        onChange={(e) => setNewMenuName(e.target.value)}
                        placeholder="e.g. Pizza, Mains, Drinks"
                        autoFocus={cats.length === 0 || wantNewGroup}
                      />
                    </Field>
                    <Btn
                      variant="light"
                      className="text-[#0d4f46]"
                      disabled={savingGroup || !newMenuName.trim()}
                      onClick={() => {
                        setSavingGroup(true);
                        void createMenuGroup(newMenuName)
                          .then(async (created) => {
                            if (created && rid) await loadMenu(Number(rid));
                          })
                          .finally(() => setSavingGroup(false));
                      }}
                    >
                      {savingGroup ? "Adding…" : "Create group"}
                    </Btn>
                  </div>
                )}
                <Field label="Vendor base price (FRw)">
                  <Input value={basePrice} onChange={(e) => setBasePrice(e.target.value)} />
                </Field>
                <Field label="Your markup (FRw)">
                  <Input value={markup} onChange={(e) => setMarkup(e.target.value)} />
                </Field>
                <div className="md:col-span-2 rounded-xl bg-[#0d4f46]/5 px-4 py-3 text-sm">
                  <span className="text-muted-foreground">Customer will see </span>
                  <span className="font-bold text-[#0d4f46]">{frw(customerPreview)}</span>
                  <span className="text-muted-foreground"> (+ delivery at checkout)</span>
                </div>
                <div className="md:col-span-2 space-y-3 rounded-2xl border border-[#0d4f46]/20 bg-[#0d4f46]/[0.04] p-4">
                  <label className="flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={promoActive}
                      onChange={(e) => setPromoActive(e.target.checked)}
                    />
                    <span>
                      <span className="font-bold text-[#0d4f46]">Buy 1 Get 1 promo</span>
                      <span className="mt-0.5 block text-muted-foreground">
                        Customers see a promo badge on this dish. After adding it, they pick which free dish they want — no
                        coupon code.
                      </span>
                    </span>
                  </label>
                  {promoActive ? (
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Free dish choices (leave empty = same dish free)
                      </p>
                      <div className="grid max-h-40 gap-2 overflow-y-auto sm:grid-cols-2">
                        {items
                          .filter((i) => i.id !== editingId)
                          .map((i) => {
                            const checked = promoGetIds.includes(i.id);
                            return (
                              <label key={i.id} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) =>
                                    setPromoGetIds((prev) =>
                                      e.target.checked ? [...prev, i.id] : prev.filter((id) => id !== i.id),
                                    )
                                  }
                                />
                                <span className="truncate">{i.name}</span>
                              </label>
                            );
                          })}
                      </div>
                      {items.filter((i) => i.id !== editingId).length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          No other dishes yet — customers can pick another of this same dish for free.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
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
      ) : null}

      {rid && !loading
        ? cats.map((menu) => {
            const dishes = items.filter((i) => i.categoryId === menu.id);
            return (
              <Card key={menu.id} className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {renameId === menu.id ? (
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
                      <Btn
                        onClick={async () => {
                          await api(`/api/admin/restaurants/${rid}/categories/${menu.id}`, {
                            method: "PUT",
                            json: { name: renameValue },
                          });
                          setRenameId(null);
                          await loadMenu(Number(rid));
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
                    <h2 className="text-lg font-bold text-[#0d4f46]">{menu.name}</h2>
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
                        if (!confirm(`Delete the ${menu.name} group? Remove dishes first.`)) return;
                        try {
                          await api(`/api/admin/restaurants/${rid}/categories/${menu.id}`, { method: "DELETE" });
                          toast.success("Menu group removed");
                          await loadMenu(Number(rid));
                          bumpCatalog();
                        } catch (e) {
                          toast.error((e as Error).message);
                        }
                      }}
                    >
                      <Trash2 className="mr-1 h-4 w-4" />
                      Delete group
                    </GhostBtn>
                  </div>
                </div>
                {dishes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No dishes in this group yet.</p>
                ) : (
                  <div className="grid gap-3">
                    {dishes.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-wrap items-center gap-3 rounded-2xl bg-muted/60 p-3"
                      >
                        <img src={img(item.imageUrl)} alt="" className="h-16 w-16 rounded-xl object-cover" />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">
                            {item.name}
                            {item.promoActive ? (
                              <span className="ml-2 rounded-full bg-[#0d4f46] px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                                {item.promoLabel || "Buy 1 Get 1"}
                              </span>
                            ) : null}
                          </p>
                          {item.description ? (
                            <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                          ) : null}
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                            <span>Vendor {frw(item.basePrice)}</span>
                            <span>Markup {frw(item.adminMarkup)}</span>
                            <span className="font-bold text-[#0d4f46]">Customer {frw(item.customerPrice)}</span>
                          </div>
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={item.isAvailable}
                            onChange={async (e) => {
                              await api(`/api/admin/restaurants/${rid}/menu/${item.id}`, {
                                method: "PUT",
                                json: { isAvailable: e.target.checked },
                              });
                              await loadMenu(Number(rid));
                              bumpCatalog();
                            }}
                          />
                          Available
                        </label>
                        <Field label="Markup">
                          <Input
                            className="w-24"
                            defaultValue={String(item.adminMarkup)}
                            onBlur={async (e) => {
                              const data = await api<{ adminMarkup: number; customerPrice: number }>(
                                `/api/admin/menu/${item.id}/markup`,
                                { method: "PUT", json: { adminMarkup: Number(e.target.value) } },
                              );
                              setItems((prev) =>
                                prev.map((i) =>
                                  i.id === item.id
                                    ? {
                                        ...i,
                                        adminMarkup: data.adminMarkup,
                                        customerPrice: data.customerPrice,
                                      }
                                    : i,
                                ),
                              );
                              bumpCatalog();
                              toast.success(`Customer price ${frw(data.customerPrice)}`);
                            }}
                          />
                        </Field>
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
                              await api(`/api/admin/restaurants/${rid}/menu/${item.id}`, { method: "DELETE" });
                              toast.success("Dish deleted");
                              await loadMenu(Number(rid));
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
          })
        : null}
    </div>
  );
}
