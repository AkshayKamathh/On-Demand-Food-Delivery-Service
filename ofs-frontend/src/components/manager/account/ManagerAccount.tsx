"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import ManagerNavbar from "@/components/manager/ManagerNavbar";
import {
  UserCircle,
  Mail,
  Shield,
  LogOut,
  Search,
  UserCheck,
  UserX,
} from "lucide-react";

type Profile = {
  id: string;
  email: string | null;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
};

type SearchedUser = {
  id: string;
  username: string | null;
  full_name: string | null;
  role: string;
};

export default function ManagerAccountPage() {
  const router = useRouter();

  // ── Current manager profile 
  const [profile, setProfile]   = useState<Profile | null>(null);
  const [loading, setLoading]   = useState(true);
  const [fullName, setFullName] = useState("");
  const [saved, setSaved]       = useState(false);
  const [saveError, setSaveError] = useState("");


  // ── Load current manager 
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);

        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) {
          router.replace("/");
          return;
        }

        const user = authData.user;

        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("username, full_name, avatar_url, role")
          .eq("id", user.id)
          .single();

        if (profileError) console.error(profileError);

        // Guard: non-managers shouldn't be here
        if (profileData?.role !== "manager") {
          router.replace("/");
          return;
        }

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

  // ── Save profile edits 
  async function handleSave() {
    if (!profile) return;
    setSaveError("");
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);

      if (error) throw error;

      setProfile((prev) => prev ? { ...prev, full_name: fullName.trim() || null } : prev);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setSaveError(e?.message ?? "Failed to save.");
    }
  }

  // ── Sign out 
  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/");
  }


  // ── Loading / guard 
  if (loading) {
    return (
      <>
        <ManagerNavbar />
        <main className="min-h-screen bg-gradient-to-b from-emerald-50 via-zinc-100 to-zinc-100 dark:from-zinc-950 dark:via-emerald-950/20 dark:to-zinc-950 flex items-center justify-center">
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">Loading account…</p>
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
      <main className="min-h-screen bg-gradient-to-b from-emerald-50 via-zinc-100 to-zinc-100 dark:from-zinc-950 dark:via-emerald-950/20 dark:to-zinc-950 p-6">
        <div className="mx-auto w-full max-w-3xl space-y-6">

          {/* ── Profile card  */}
          <div className="bg-white/80 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 backdrop-blur-sm rounded-2xl p-7 shadow-xl shadow-black/10 dark:shadow-black/30">

            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-2xl font-bold select-none overflow-hidden">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </div>

              <div>
                <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                  {profile.full_name ?? profile.username ?? "Manager"}
                </h1>
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs border border-emerald-300/80 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-50/60 dark:bg-emerald-900/20 font-medium">
                    <Shield className="h-3 w-3" /> Manager
                  </span>
                  {profile.email && (
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {profile.email}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Editable fields */}
            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
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

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <input
                    disabled
                    className={inputClass + " pl-9 opacity-50 cursor-not-allowed"}
                    value={profile.email ?? ""}
                    readOnly
                  />
                </div>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Email is managed by your auth provider and cannot be changed here.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Username
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm select-none">@</span>
                  <input
                    disabled
                    className={inputClass + " pl-7 opacity-50 cursor-not-allowed"}
                    value={profile.username ?? ""}
                    readOnly
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3 flex-wrap">
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

          {/*  Danger zone */}
          <div className="bg-white/80 dark:bg-zinc-800/60 border border-red-200/60 dark:border-red-500/20 backdrop-blur-sm rounded-2xl p-7 shadow-xl shadow-black/10 dark:shadow-black/30">
            <h2 className="text-lg font-semibold text-red-600 dark:text-red-400">Danger Zone</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Irreversible actions — proceed with caution.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors shadow-sm"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
              <button className="px-4 py-2 rounded-xl border border-red-300/80 dark:border-red-500/40 text-red-600 dark:text-red-300 hover:bg-red-50/60 dark:hover:bg-red-900/20 text-sm font-medium transition-colors">
                Deactivate Account
              </button>
            </div>
          </div>

        </div>
      </main>
    </>
  );
}

//Sub-components 

function RoleBadge({ role }: { role: string }) {
  const isManager = role === "manager";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-medium ${
        isManager
          ? "border-emerald-300/80 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-50/60 dark:bg-emerald-900/20"
          : "border-zinc-300/80 dark:border-zinc-500/40 text-zinc-600 dark:text-zinc-300 bg-zinc-50/60 dark:bg-zinc-900/20"
      }`}
    >
      {isManager ? <Shield className="h-3 w-3" /> : <UserCircle className="h-3 w-3" />}
      {isManager ? "Manager" : "User"}
    </span>
  );
}

//Styles 

const inputClass =
  "w-full px-3 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-transparent text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-shadow";