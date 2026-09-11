import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { Camera, KeyRound, UserRound } from "lucide-react";
import { api, img } from "@/lib/api";
import { useAuth, type User } from "@/lib/auth";
import { Btn, Field, Input } from "./ui";

export function ProfilePage() {
  const { user, ready, setUser, logout } = useAuth();
  const [, setLoc] = useLocation();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      setLoc("/login?next=/profile");
      return;
    }
    setFirstName(user.firstName || "");
    setLastName(user.lastName || "");
    setPhone(user.phone || "");
  }, [ready, user, setLoc]);

  function applyUser(next: User) {
    setUser(next);
    setFirstName(next.firstName || "");
    setLastName(next.lastName || "");
    setPhone(next.phone || "");
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (savingProfile) return;
    setSavingProfile(true);
    try {
      const data = await api<{ user: User }>("/api/auth/profile", {
        method: "PUT",
        json: { firstName, lastName, phone },
      });
      applyUser(data.user);
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (savingPassword) return;
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    setSavingPassword(true);
    try {
      await api("/api/auth/password", {
        method: "POST",
        json: { currentPassword, newPassword },
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password changed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change password");
    } finally {
      setSavingPassword(false);
    }
  }

  async function onAvatarFile(file: File | null) {
    if (!file || uploading) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const data = await api<{ user: User }>("/api/auth/avatar", { method: "POST", form });
      applyUser(data.user);
      toast.success("Profile photo updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload photo");
    } finally {
      setUploading(false);
    }
  }

  async function removeAvatar() {
    if (uploading) return;
    setUploading(true);
    try {
      const data = await api<{ user: User }>("/api/auth/avatar", { method: "DELETE" });
      applyUser(data.user);
      toast.success("Profile photo removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove photo");
    } finally {
      setUploading(false);
    }
  }

  if (!ready || !user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-muted-foreground">
        Loading account…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Account</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-foreground">Your profile</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Update your photo, contact details, and password for {user.email}.
        </p>
      </div>

      <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-card sm:p-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="relative">
            <div className="h-24 w-24 overflow-hidden rounded-full ring-4 ring-[#0d4f46]/10">
              {user.avatarUrl ? (
                <img src={img(user.avatarUrl)} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[#0d4f46] text-2xl font-bold text-white">
                  {(user.firstName?.[0] || "U").toUpperCase()}
                  {(user.lastName?.[0] || "").toUpperCase()}
                </div>
              )}
            </div>
            <label className="absolute -bottom-1 -right-1 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-primary text-white shadow-md shadow-primary/30">
              <Camera className="h-4 w-4" />
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                disabled={uploading}
                onChange={(e) => void onAvatarFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <h2 className="text-lg font-bold text-foreground">
              {user.firstName} {user.lastName}
            </h2>
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-primary">{user.role}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
              <label className="inline-flex cursor-pointer">
                <span className="rounded-full bg-[#0d4f46] px-4 py-2 text-xs font-semibold text-white">
                  {uploading ? "Uploading…" : "Change photo"}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  disabled={uploading}
                  onChange={(e) => void onAvatarFile(e.target.files?.[0] || null)}
                />
              </label>
              {user.avatarUrl ? (
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => void removeAvatar()}
                  className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-foreground"
                >
                  Remove photo
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <form onSubmit={(e) => void saveProfile(e)} className="space-y-4 rounded-3xl border border-black/5 bg-white p-5 shadow-card sm:p-6">
        <div className="flex items-center gap-2">
          <UserRound className="h-4 w-4 text-primary" />
          <h2 className="text-base font-bold">Personal details</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name">
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </Field>
          <Field label="Last name">
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </Field>
        </div>
        <Field label="Email">
          <Input value={user.email} disabled className="opacity-70" />
        </Field>
        <Field label="Phone">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="+250 7…" />
        </Field>
        <Btn type="submit" disabled={savingProfile} className="w-full sm:w-auto">
          {savingProfile ? "Saving…" : "Save details"}
        </Btn>
      </form>

      <form onSubmit={(e) => void savePassword(e)} className="space-y-4 rounded-3xl border border-black/5 bg-white p-5 shadow-card sm:p-6">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          <h2 className="text-base font-bold">Change password</h2>
        </div>
        <Field label="Current password">
          <Input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </Field>
        <Field label="New password">
          <Input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={6}
          />
        </Field>
        <Field label="Confirm new password">
          <Input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
          />
        </Field>
        <Btn type="submit" disabled={savingPassword} className="w-full sm:w-auto">
          {savingPassword ? "Updating…" : "Update password"}
        </Btn>
      </form>

      <div className="flex flex-wrap items-center gap-3 pb-8 text-sm">
        {user.role === "customer" ? (
          <Link href="/orders" className="font-semibold text-primary hover:underline">
            My orders
          </Link>
        ) : null}
        {user.role === "vendor" ? (
          <Link href="/vendor" className="font-semibold text-primary hover:underline">
            Vendor panel
          </Link>
        ) : null}
        {user.role === "admin" ? (
          <Link href="/admin" className="font-semibold text-primary hover:underline">
            Admin panel
          </Link>
        ) : null}
        <button
          type="button"
          className="font-semibold text-muted-foreground hover:text-foreground"
          onClick={() => {
            logout();
            setLoc("/");
          }}
        >
          Log out
        </button>
      </div>
    </div>
  );
}
