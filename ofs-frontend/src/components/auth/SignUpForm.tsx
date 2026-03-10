"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PasswordToggleButton from "./PasswordToggleButton";
import { usePasswordVisibility } from "@/hooks/usePasswordVisibility";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { supabase } from "@/lib/supabaseClient";
import {
  inputClasses,
  labelClasses,
  buttonClasses,
  dividerClasses,
  linkClasses,
  subtitleClasses,
  errorClasses,
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

export default function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const passwordVis = usePasswordVisibility();
  const confirmPasswordVis = usePasswordVisibility();
  const router = useRouter();

  const showRequirements =
    passwordFocused || (password.length > 0 && !allMet(password));
  const passwordValid = allMet(password);

  const handleSignup = async (e: React.FormEvent) => {
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
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      // User Logs in
      router.push("/login");
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong.");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-sm">
      <div className="animate-fade-slide-up delay-100">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
          Create an account
        </h1>
        <p className={subtitleClasses + " mt-1"}>
          Sign up to get started
        </p>
      </div>

      {error && (
        <div className={errorClasses + " animate-fade-slide-up"}>
          {error}
        </div>
      )}

      <form onSubmit={handleSignup} className="flex flex-col gap-4">
        {/* Username */}
        <div className="animate-fade-slide-up delay-200 flex flex-col gap-1.5">
          <label className={labelClasses} htmlFor="username">
            Username
          </label>
          <input
            id="username"
            type="text"
            placeholder="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className={inputClasses}
          />
        </div>

        {/* Email */}
        <div className="animate-fade-slide-up delay-300 flex flex-col gap-1.5">
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

        {/* Password */}
        <div className="animate-fade-slide-up delay-400 flex flex-col gap-1.5">
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
          {showRequirements && (
            <ul className="flex flex-col gap-1 mt-1">
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
        <div className="animate-fade-slide-up delay-500 flex flex-col gap-1.5">
          <label className={labelClasses} htmlFor="confirmPassword">
            Confirm Password
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

        {/* Submit Button */}
        <div className="animate-fade-slide-up delay-600">
          <button
            type="submit"
            disabled={loading}
            className={cn(buttonClasses)}
          >
            {loading ? "Creating account..." : "Sign up"}
          </button>
        </div>
      </form>

      <div className="animate-fade-slide-up delay-700 flex items-center gap-3">
        <div className={dividerClasses} />
        <span className="text-zinc-400 dark:text-zinc-500 text-xs">or</span>
        <div className={dividerClasses} />
      </div>

      <p
        className={cn("animate-fade-slide-up text-center", subtitleClasses)}
        style={{ animationDelay: "900ms" }}
      >
        Already have an account?{" "}
        <Link href="/login" className={linkClasses}>
          Sign in
        </Link>
      </p>
    </div>
  );
}
