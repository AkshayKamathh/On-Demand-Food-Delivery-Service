"use client";

import { useState, useContext, useEffect } from "react";
import { cn } from "@/lib/cn";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function OrderView() {
    // to do implement order view for specific accounts

  const [checkingAuth, setCheckingAuth] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Auth timeout")), 6000)
        );
        const result: any = await Promise.race([supabase.auth.getUser(), timeout]);
        const user = result?.data?.user;
        if (!user) {
          router.replace("/");
          return;
        }
      } catch {
        router.replace("/");
      } finally {
        setCheckingAuth(false);
      }
    };

    checkAuth();
  }, [router]);

  return (
    <>
    </>
  );
}





