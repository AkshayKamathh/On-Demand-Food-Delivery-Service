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
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/");
        return;
      }
    };

    checkAuth();
  }, [router]);

  return (
    <>
    </>
  );
}





