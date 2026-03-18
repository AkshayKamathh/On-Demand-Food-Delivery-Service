"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import PasswordToggleButton from "./PasswordToggleButton";
import { usePasswordVisibility } from "@/hooks/usePasswordVisibility";
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

const SPECIAL_CHARS = "!@#$%^&*()_+-=[]{}|;:,.<>?";

const requirements = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "One uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "One lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  {
    label: `One special character (${SPECIAL_CHARS})`,
    test: (p: string) => /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(p),
  },
];

const allMet = (p: string) => requirements.every((r) => r.test(p));

export default function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  
  const passwordVis = usePasswordVisibility();
  const confirmPasswordVis = usePasswordVisibility();
  const router = useRouter();
  const searchParams = useSearchParams();

  const showRequirements =
    passwordFocused || (password.length > 0 && !allMet(password));
  const passwordValid = allMet(password);

  // Can be moved to backend later also if we plan
  // Check if we're in recovery mode (from reset email)
  useEffect(() => {
    const hash = searchParams.get("hash") || window.location.hash;
    if (hash) {
      const url = new URL(window.location.href);
      const hashParams = new URLSearchParams(hash.substring(1));
      const type = hashParams.get("type");
      
      if (type === "recovery") {
        // User came from password reset email
        console.log("Recovery mode active");
      }
    }
  }, [searchParams]);

  const handleReset = async (e: React.SubmitEvent) => {
    e.preventDefault();
    setError(null);

    if (!passwordValid) {
      setError("Password must meet all requirements.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message);
      } else {
        setSuccess(true);
        // Redirect to login after 2 seconds
        setTimeout(() => {
          router.push("/login");
        }, 2000);
      }
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col gap-8 w-full max-w-sm text-center">
        <div className="animate-fade-slide-up delay-100">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
            Password Updated!
          </h1>
          <p className={subtitleClasses + " mt-1 text-green-600 dark:text-green-400"}>
            Your password has been successfully reset. Redirecting to login...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-sm">
      <div className="animate-fade-slide-up delay-100">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
          Reset Your Password
        </h1>
        <p className={cn(subtitleClasses, "mt-1")}>
          Enter your new password below.
        </p>
      </div>

      {error && (
        <div className={errorClasses + " animate-fade-slide-up"}>
          {error}
        </div>
      )}

      <form onSubmit={handleReset} className="flex flex-col gap-4">
        {/* Password */}
        <div className="animate-fade-slide-up delay-200 flex flex-col gap-1.5">
          <label className={labelClasses} htmlFor="password">
            New Password
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
          
          {showRequirements && (
            <ul className="flex flex-col gap-1 mt-2">
              {requirements.map((req) => {
                const met = req.test(password);
                return (
                  <li
                    key={req.label}
                    className={cn(
                      "flex items-center gap-2 text-xs",
                      met
                        ? "text-green-500 dark:text-green-400"
                        : "text-zinc-400 dark:text-zinc-500"
                    )}
                  >
                    <span>{met ? "✓" : "○"}</span>
                    {req.label}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Confirm Password */}
        <div className="animate-fade-slide-up delay-300 flex flex-col gap-1.5">
          <label className={labelClasses} htmlFor="confirmPassword">
            Confirm New Password
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              type={confirmPasswordVis.visible ? "text" : "password"}
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className={cn(inputClasses, "pr-26")}
            />
            <PasswordToggleButton
              visible={confirmPasswordVis.visible}
              onToggle={confirmPasswordVis.toggle}
            />
          </div>
        </div>

        <div className="animate-fade-slide-up delay-400">
          <button
            type="submit"
            disabled={loading}
            className={buttonClasses}
          >
            {loading ? "Updating..." : "Reset Password"}
          </button>
        </div>
      </form>

      <p className={cn("animate-fade-slide-up text-center", subtitleClasses)}>
        <Link href="/login" className={linkClasses}>
          Back to login
        </Link>
      </p>
    </div>
  );
}
