import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Star, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { Btn, Card, ConfirmDialog, Empty, Field, Textarea } from "../ui";
import { AdminGuide, AdminMetric, FilterTabs } from "./AdminUi";

type ReviewRow = {
  orderId: number;
  orderNumber: string;
  rating: number;
  reviewComment: string | null;
  reviewedAt: string | null;
  reviewVisible: boolean;
  customerName: string;
  customerEmail: string;
  restaurantName: string;
  restaurantId: number;
  createdAt: string;
};

function Stars({
  value,
  onChange,
  readonly = false,
}: {
  value: number;
  onChange?: (n: number) => void;
  readonly?: boolean;
}) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(n)}
          className={readonly ? "cursor-default" : "transition hover:scale-110"}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
        >
          <Star
            className={`h-5 w-5 ${n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
          />
        </button>
      ))}
    </div>
  );
}

function formatWhen(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB");
  } catch {
    return iso;
  }
}

export function AdminReviews() {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [filter, setFilter] = useState("ALL");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftRating, setDraftRating] = useState(5);
  const [draftComment, setDraftComment] = useState("");
  const [draftVisible, setDraftVisible] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ReviewRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function reload() {
    setReviews(await api<ReviewRow[]>("/api/admin/reviews"));
  }

  useEffect(() => {
    reload().catch((e) => toast.error(e instanceof Error ? e.message : "Could not load reviews"));
  }, []);

  const filtered = useMemo(() => {
    return reviews.filter((r) => {
      if (filter === "VISIBLE") return r.reviewVisible;
      if (filter === "HIDDEN") return !r.reviewVisible;
      if (filter === "LOW") return r.rating <= 2;
      if (filter === "HIGH") return r.rating >= 4;
      return true;
    });
  }, [reviews, filter]);

  const average =
    reviews.length > 0 ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) : "—";

  function startEdit(review: ReviewRow) {
    setEditingId(review.orderId);
    setDraftRating(review.rating);
    setDraftComment(review.reviewComment || "");
    setDraftVisible(review.reviewVisible);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit() {
    if (editingId == null) return;
    setSaving(true);
    try {
      await api(`/api/admin/reviews/${editingId}`, {
        method: "PUT",
        json: {
          rating: draftRating,
          reviewComment: draftComment,
          reviewVisible: draftVisible,
        },
      });
      toast.success("Review updated");
      setEditingId(null);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save review");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api(`/api/admin/reviews/${deleteTarget.orderId}`, { method: "DELETE" });
      toast.success(`Review removed from ${deleteTarget.orderNumber}`);
      setDeleteTarget(null);
      if (editingId === deleteTarget.orderId) setEditingId(null);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete review");
    } finally {
      setDeleting(false);
    }
  }

  async function toggleVisible(review: ReviewRow) {
    try {
      await api(`/api/admin/reviews/${review.orderId}`, {
        method: "PUT",
        json: {
          rating: review.rating,
          reviewComment: review.reviewComment || "",
          reviewVisible: !review.reviewVisible,
        },
      });
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update visibility");
    }
  }

  return (
    <div className="space-y-4">
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Remove this review?"
        description={
          deleteTarget ? (
            <>
              <p>
                This permanently removes the {deleteTarget.rating}-star review on{" "}
                <span className="font-bold">{deleteTarget.orderNumber}</span> from {deleteTarget.restaurantName}.
              </p>
              <p className="mt-2 text-xs">The customer can submit a new review later if the order is still delivered.</p>
            </>
          ) : null
        }
        confirmLabel="Remove review"
        cancelLabel="Keep review"
        loading={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />

      <AdminGuide>
        <p className="font-bold">Customer reviews</p>
        <p className="mt-1 text-muted-foreground">
          Reviews are left after delivery on My Orders. Edit stars or comments, hide inappropriate reviews from the public
          site, or remove them completely.
        </p>
      </AdminGuide>

      <div className="grid gap-4 sm:grid-cols-3">
        <AdminMetric label="Total reviews" value={String(reviews.length)} />
        <AdminMetric label="Average rating" value={average === "—" ? "—" : `${average} ★`} />
        <AdminMetric
          label="Hidden"
          value={String(reviews.filter((r) => !r.reviewVisible).length)}
          hint="Not shown publicly when hidden"
        />
      </div>

      <FilterTabs
        active={filter}
        onChange={setFilter}
        tabs={[
          { id: "ALL", label: "All", count: reviews.length },
          { id: "HIGH", label: "4–5 stars", count: reviews.filter((r) => r.rating >= 4).length },
          { id: "LOW", label: "1–2 stars", count: reviews.filter((r) => r.rating <= 2).length },
          { id: "VISIBLE", label: "Visible", count: reviews.filter((r) => r.reviewVisible).length },
          { id: "HIDDEN", label: "Hidden", count: reviews.filter((r) => !r.reviewVisible).length },
        ]}
      />

      {filtered.length === 0 ? (
        <Empty
          title="No reviews yet"
          body={filter === "ALL" ? "Reviews appear here after customers rate delivered orders." : "No reviews match this filter."}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((review) => {
            const editing = editingId === review.orderId;
            return (
              <Card key={review.orderId} className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold">
                      {review.orderNumber} · {review.restaurantName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {review.customerName} · {review.customerEmail}
                    </p>
                    <p className="text-xs text-muted-foreground">Reviewed {formatWhen(review.reviewedAt)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {!review.reviewVisible ? (
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-amber-800">
                        Hidden
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className="rounded-full p-2 text-muted-foreground hover:bg-muted"
                      title={review.reviewVisible ? "Hide review" : "Show review"}
                      onClick={() => void toggleVisible(review)}
                    >
                      {review.reviewVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                    {!editing ? (
                      <>
                        <Btn variant="outline" size="sm" onClick={() => startEdit(review)}>
                          Edit
                        </Btn>
                        <Btn variant="ghost" size="sm" onClick={() => setDeleteTarget(review)}>
                          <Trash2 className="h-4 w-4" />
                        </Btn>
                      </>
                    ) : null}
                  </div>
                </div>

                {editing ? (
                  <div className="space-y-3 rounded-2xl bg-muted/30 p-4">
                    <Field label="Rating">
                      <Stars value={draftRating} onChange={setDraftRating} />
                    </Field>
                    <Field label="Comment">
                      <Textarea
                        className="min-h-24 rounded-2xl"
                        value={draftComment}
                        onChange={(e) => setDraftComment(e.target.value)}
                        placeholder="Customer comment (optional)"
                      />
                    </Field>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={draftVisible}
                        onChange={(e) => setDraftVisible(e.target.checked)}
                        className="rounded border-border"
                      />
                      Show on public restaurant pages
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Btn onClick={() => void saveEdit()} disabled={saving}>
                        {saving ? "Saving…" : "Save changes"}
                      </Btn>
                      <Btn variant="ghost" onClick={cancelEdit} disabled={saving}>
                        Cancel
                      </Btn>
                    </div>
                  </div>
                ) : (
                  <>
                    <Stars value={review.rating} readonly />
                    {review.reviewComment ? (
                      <p className="text-sm leading-relaxed text-foreground">{review.reviewComment}</p>
                    ) : (
                      <p className="text-sm italic text-muted-foreground">No written comment</p>
                    )}
                  </>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
