// src/app/(shop)/manager/layout.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const check = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.replace("/");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", sessionData.session.user.id)
        .single();

      if (profile?.role !== "manager") {
        router.replace("/");
        return;
      }

      setAuthorized(true);
    };

    check();
  }, [router]);

  if (!authorized) {
    return (
      <main className="min-h-screen flex items-center justify-center text-zinc-600 dark:text-zinc-300">
        Checking access...
      </main>
    );
  }

  return <>{children}</>;
}