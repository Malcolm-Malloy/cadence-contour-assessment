import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/**
 * Resolves the authenticated user plus their profile (role) from the
 * server-side session. Returns null if there is no authenticated session,
 * so callers can redirect/reject rather than assume a user exists.
 *
 * This is the single place API routes and pages should derive "who is
 * calling" from — never trust a user id or role passed in a request body.
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    return null;
  }

  const userId = data.claims.sub as string;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, created_at")
    .eq("id", userId)
    .single<Profile>();

  if (profileError || !profile) {
    return null;
  }

  return { supabase, userId, profile };
}
