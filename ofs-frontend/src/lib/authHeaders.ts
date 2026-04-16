import { supabase } from "@/lib/supabaseClient";

function withTimeout<T>(promise: Promise<T>, ms: number, message: string) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

export async function getAuthHeaders() {
  // Fetching the access token from the session is sufficient and avoids an extra
  // network/auth roundtrip that can intermittently hang.
  const { data: sessionData, error: sessionError } = await withTimeout(
    supabase.auth.getSession(),
    8000,
    "Timed out fetching auth session"
  );
  if (sessionError) throw sessionError;

  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Not authenticated");

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}