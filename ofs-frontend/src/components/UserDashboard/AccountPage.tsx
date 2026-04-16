"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { User, LogOut } from "lucide-react";
import Link from "next/link";

type Profile = {
  id: string;
  email: string | null;
  username: string | null;
  avatar_url: string | null;
};

export default function AccountPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const timeout = (ms: number, message: string) =>
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error(message)), ms));

    const loadProfile = async () => {
      try {
        setLoading(true);

        let user = null;

        for (let i = 0; i < 3; i++) {
          try {
            const result: any = await Promise.race([
              supabase.auth.getUser(),
              timeout(4000, "Timed out fetching user"),
            ]);
            const { data, error } = result;
            if (!error && data.user) {
              user = data.user;
              break;
            }
          } catch {
            // retry a couple times
          }
          await wait(300);
        }

        if (!user) {
          if (!cancelled) {
            setProfile(null);
            router.replace("/");
          }
          return;
        }

        const profileResult: any = await Promise.race([
          supabase
            .from("profiles")
            .select("username, avatar_url")
            .eq("id", user.id)
            .single(),
          timeout(8000, "Timed out loading profile"),
        ]);
        const { data: profileData, error: profileError } = profileResult;

        if (profileError) {
          console.error(profileError);
        }

        if (!cancelled) {
          setProfile({
            id: user.id,
            email: user.email ?? null,
            username: profileData?.username ?? null,
            avatar_url: profileData?.avatar_url ?? null,
          });
        }
      } catch (err) {
        console.error("Failed to load profile:", err);
        if (!cancelled) {
          setProfile(null);
          router.replace("/");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  if (loading) {
    return (
      <main className="min-h-screen animate-fade-slide-up delay-100 bg-zinc-100 dark:bg-zinc-900 p-6 flex items-center justify-center">
        <div className="text-lg">Loading account...</div>
      </main>
    );
  }

  if (!profile) return null;

  return (
    <main className="min-h-screen animate-fade-slide-up delay-200 pt-10 bg-gradient-to-b from-amber-100 via-emerald-100 to-amber-100 dark:from-zinc-950 dark:via-emerald-800 dark:to-zinc-950 text-zinc-900 dark:text-violet-50">
      <div className="mx-auto w-full max-w-4xl bg-white/80 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 backdrop-blur-sm rounded-2xl p-8 shadow-xl shadow-black/10 dark:shadow-black/30">
        <div className="flex items-center gap-3 mb-6">
          <User className="h-8 w-8 text-emerald-600" />
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Your Account
          </h1>
        </div>

        <p className="mb-8 text-zinc-600 dark:text-zinc-300">
          Manage your profile information and account settings. WIP
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="rounded-2xl border border-zinc-200 dark:border-zinc-700/50 bg-white/60 dark:bg-zinc-900/30 p-6">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              Account Details
            </h2>
            <div className="space-y-4">
              <div className="flex flex-col">
                <span className="text-sm text-zinc-600 dark:text-zinc-300 mb-1">Username</span>
                <span className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
                  {profile.username || "No username set"}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-zinc-600 dark:text-zinc-300 mb-1">Email</span>
                <span className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
                  {profile.email}
                </span>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 dark:border-zinc-700/50 bg-white/60 dark:bg-zinc-900/30 p-6">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              Profile Picture
            </h2>

            <div className="text-center mb-6">
              <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-emerald-500 to-amber-500 flex items-center justify-center text-2xl font-bold text-white mb-3">
                {profile.username?.[0]?.toUpperCase() ||
                  profile.email?.[0]?.toUpperCase() ||
                  "U"}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Profile picture upload WIP
              </p>
            </div>

            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium shadow-lg shadow-red-500/20 hover:shadow-red-500/30 transition-all"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </section>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/userDashboard"
            className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all"
          >
            Back to Products
          </Link>
        </div>
      </div>
    </main>
  );
}