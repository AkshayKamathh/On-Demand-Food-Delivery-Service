"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import ManagerNavbar from "@/components/manager/ManagerNavbar";
import { Shield, LogOut, Mail, UserCircle } from "lucide-react";
import Link from "next/link";

type Profile = {
  id: string;
  email: string | null;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
};

export default function ManagerAccountPage() {
  const router = useRouter();

  const [profile, setProfile]     = useState<Profile | null>(null);
  const [loading, setLoading]     = useState(true);
  const [fullName, setFullName]   = useState("");
  const [saved, setSaved]         = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) { router.replace("/"); return; }

        const user = authData.user;
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("username, full_name, avatar_url, role")
          .eq("id", user.id)
          .single();

        if (profileError) console.error(profileError);
        if (profileData?.role !== "manager") { router.replace("/"); return; }

        if (!cancelled) {
          setProfile({
            id: user.id,
            email: user.email ?? null,
            username: profileData?.username ?? null,
            full_name: profileData?.full_name ?? null,
            avatar_url: profileData?.avatar_url ?? null,
            role: profileData?.role ?? "manager",
          });
          setFullName(profileData?.full_name ?? "");
        }
      } catch (err) {
        console.error("Failed to load manager profile:", err);
        if (!cancelled) router.replace("/");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [router]);

  async function handleSave() {
    if (!profile) return;
    setSaveError("");
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim() || null, updated_at: new Date().toISOString() })
        .eq("id", profile.id);
      if (error) throw error;
      setProfile((prev) => prev ? { ...prev, full_name: fullName.trim() || null } : prev);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setSaveError(e?.message ?? "Failed to save.");
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  if (loading) {
    return (
      <>
        <ManagerNavbar />
        <main className="min-h-screen bg-gradient-to-b from-amber-100 via-emerald-100 to-amber-100 dark:from-zinc-950 dark:via-emerald-800 dark:to-zinc-950 flex items-center justify-center">
          <p className="text-zinc-500 dark:text-zinc-400 animate-pulse">Loading account…</p>
        </main>
      </>
    );
  }

  if (!profile) return null;

  const initials =
    (profile.full_name ?? profile.username ?? profile.email ?? "M")[0].toUpperCase();

  return (
    <>
      <ManagerNavbar />
      <main className="min-h-screen animate-fade-slide-up delay-200 pt-10 bg-gradient-to-b from-amber-100 via-emerald-100 to-amber-100 dark:from-zinc-950 dark:via-emerald-800 dark:to-zinc-950 text-zinc-900 dark:text-violet-50 p-6">
        <div className="mx-auto w-full max-w-4xl bg-white/80 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 backdrop-blur-sm rounded-2xl p-8 shadow-xl shadow-black/10 dark:shadow-black/30">

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Shield className="h-8 w-8 text-emerald-600" />
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              Manager Account
            </h1>
          </div>

          <p className="mb-8 text-zinc-600 dark:text-zinc-300">
            Manage your profile information and account settings.
          </p>

          {/* Two-column grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Left — Account details */}
            <section className="rounded-2xl border border-zinc-200 dark:border-zinc-700/50 bg-white/60 dark:bg-zinc-900/30 p-6">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                Account Details
              </h2>

              <div className="space-y-5">

                {/* Email (read-only) */}
                <div className="flex flex-col">
                  <span className="text-sm text-zinc-600 dark:text-zinc-300 mb-1">Email</span>
                  <span className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
                    {profile.email}
                  </span>
                </div>

                {/* Role */}
                <div className="flex flex-col">
                  <span className="text-sm text-zinc-600 dark:text-zinc-300 mb-2">Role</span>
                  <span className="inline-flex items-center gap-1.5 w-fit px-2.5 py-1 rounded-full text-xs border border-emerald-300/80 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-50/60 dark:bg-emerald-900/20 font-medium">
                    <Shield className="h-3 w-3" /> Manager
                  </span>
                </div>

                {/* Editable full name */}
                <div className="flex flex-col">
                  <label className="text-sm text-zinc-600 dark:text-zinc-300 mb-1.5">
                    Full Name
                  </label>
                  <div className="relative">
                    <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <input
                      className={inputClass + " pl-9"}
                      value={fullName}
                      placeholder="Your full name"
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                </div>

                {/* Save */}
                <div className="flex items-center gap-3 pt-1 flex-wrap">
                  <button
                    onClick={handleSave}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors shadow-sm"
                  >
                    Save Changes
                  </button>
                  {saved && (
                    <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                      ✓ Saved successfully
                    </span>
                  )}
                  {saveError && (
                    <span className="text-sm text-red-500">{saveError}</span>
                  )}
                </div>
              </div>
            </section>

            {/* Right — Avatar + sign out */}
            <section className="rounded-2xl border border-zinc-200 dark:border-zinc-700/50 bg-white/60 dark:bg-zinc-900/30 p-6">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                Profile Picture
              </h2>

              <div className="text-center mb-6">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="avatar"
                    className="w-24 h-24 mx-auto rounded-full object-cover mb-3"
                  />
                ) : (
                  <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-emerald-500 to-amber-500 flex items-center justify-center text-2xl font-bold text-white mb-3">
                    {initials}
                  </div>
                )}
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Profile picture upload coming soon
                </p>
              </div>

              <button
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium shadow-lg shadow-red-500/20 hover:shadow-red-500/30 transition-all"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </section>
          </div>

          {/* Bottom nav */}
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/manager/dashboard"
              className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all"
            >
              Back to Dashboard
            </Link>
          </div>

        </div>
      </main>
    </>
  );
}

const inputClass =
  "w-full px-3 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-transparent text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-shadow";