"use client";

import { cn } from "@/lib/cn";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import PasswordToggleButton from "./PasswordToggleButton";
import { usePasswordVisibility } from "@/hooks/usePasswordVisibility";
import {
  inputClasses,
  labelClasses,
  buttonClasses,
  dividerClasses,
  linkClasses,
  subtitleClasses,
  errorClasses,
} from "@/lib/theme-classes";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const passwordVis = usePasswordVisibility();
  const [passwordFocused, setPasswordFocused] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  setError(null);
  setLoading(true);

  try {
    const timeout = <T,>(ms: number, message: string) =>
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms));

    const signInResult: any = await Promise.race([
      supabase.auth.signInWithPassword({ email, password }),
      timeout<any>(12000, "Signing in timed out"),
    ]);

    const { data, error: signInError } = signInResult;

    if (signInError) {
      setError(signInError.message);
      return;
    }

    const user = data.user;
    if (!user) {
      setError("No user returned after sign in.");
      return;
    }

    const profileResult: any = await Promise.race([
      supabase.from("profiles").select("role").eq("id", user.id).single(),
      timeout<any>(8000, "Loading profile timed out"),
    ]);
    const { data: profile, error: profileError } = profileResult;

    if (profileError) {
      setError(profileError.message);
      return;
    }

    router.replace(profile?.role === "manager" ? "/manager/dashboard" : "/userDashboard");
  } catch (err: any) {
    setError(err?.message ?? "Something went wrong.");
  } finally {
    setLoading(false);
  }
};


  return (
    <div className="flex flex-col gap-6 w-full max-w-sm">
      <div className="animate-fade-slide-up delay-100">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
          Welcome back!
        </h1>
        <p className={subtitleClasses + " mt-1 text-center"}>
          Sign in to continue to OFS
        </p>
      </div>

      {error && <div className={errorClasses + " animate-fade-slide-up"}>{error}</div>}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="animate-fade-slide-up delay-200 flex flex-col gap-1.5">
          <label className={labelClasses} htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={inputClasses}
          />
        </div>

        <div className="animate-fade-slide-up delay-300 flex flex-col gap-1.5">
          <label className={labelClasses} htmlFor="password">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={passwordVis.visible ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              required
              className={cn(inputClasses, "pr-26")}
            />
            <PasswordToggleButton
              visible={passwordVis.visible}
              onToggle={passwordVis.toggle}
            />
          </div>
        </div>

        <div className="animate-fade-slide-up delay-400">
          <button type="submit" disabled={loading} className={buttonClasses}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </div>
      </form>

      <div className="animate-fade-slide-up delay-500 flex items-center gap-3">
        <div className={dividerClasses} />
        <span className="text-zinc-400 dark:text-zinc-500 text-xs">or</span>
        <div className={dividerClasses} />
      </div>

      <div className="flex flex-col gap-2">
        <p className="animate-fade-slide-up delay-700 text-center">
          <span className={subtitleClasses}>Don&apos;t have an account? </span>
          <Link href="/signup" className={linkClasses}>
            Sign up
          </Link>
        </p>
        <p className="animate-fade-slide-up text-center" style={{ animationDelay: "800ms" }}>
          <Link href="/forgot-password" className={linkClasses}>
            Forgot your password?
          </Link>
        </p>
      </div>
    </div>
  );
}