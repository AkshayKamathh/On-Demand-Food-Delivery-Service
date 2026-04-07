// src/lib/authHeaders.ts
import { supabase } from "@/lib/supabaseClient";

export async function getAuthHeaders() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated");

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}