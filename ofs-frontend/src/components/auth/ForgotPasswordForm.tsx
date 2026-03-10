"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/cn";
import {
  inputClasses,
  labelClasses,
  buttonClasses,
  subtitleClasses,
  errorClasses,
	linkClasses,
} from "@/lib/theme-classes";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSent(false);
    setLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: "http://localhost:3000/forgot-password",
        }
      );

      if (resetError) {
        setError(resetError.message);
      } else {
        setSent(true);
      }
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-sm">
      <div className="animate-fade-slide-up delay-100">
        <h1 className="text-3xl font-bold text-zinc-800 dark:text-zinc-800">
          Forgot your password?
        </h1>
        <p className={cn(subtitleClasses, "mt-1")}>
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      {error && (
        <div className={errorClasses + " animate-fade-slide-up"}>
          {error}
        </div>
      )}

      {sent && (
        <p className={cn(subtitleClasses, "text-green-600 dark:text-green-400")}>
          Check your email for a password reset link.
        </p>
      )}

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

        <div className="animate-fade-slide-up delay-300">
          <button
            type="submit"
            disabled={loading}
            className={buttonClasses}
          >
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </div>
      </form>

      <p className={cn("animate-fade-slide-up text-center", subtitleClasses)}>
        Remembered your password?{" "}
        <Link href="/login" className={linkClasses}>
          Back to login
        </Link>
      </p>
    </div>
  );
}
