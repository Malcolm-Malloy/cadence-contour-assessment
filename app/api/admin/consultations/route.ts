import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/current-user";

// GET /api/admin/consultations
// Read-only, admin-only list of every consultation in the system.
//
// The role check happens here, in the handler, using the profile resolved
// from the server-side session — not from any client-supplied header,
// query param, or body field. This is the exact check that must not be
// skipped: without it, any authenticated student could call this endpoint
// directly (bypassing a UI that merely hides the admin nav link) and read
// every other student's data. RLS's `consultations_select_admin` policy is
// a second, independent enforcement of the same rule at the database layer.
export async function GET() {
  const auth = await getCurrentUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (auth.profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { supabase } = auth;

  const { data, error } = await supabase
    .from("consultations")
    .select("*")
    .order("scheduled_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ consultations: data });
}
