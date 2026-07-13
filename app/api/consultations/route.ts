import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/current-user";

// GET /api/consultations
// Lists the authenticated student's own consultations. RLS on the
// `consultations` table already restricts rows to `student_id = auth.uid()`,
// but we also filter explicitly here so the intent is clear from the code
// alone, not just the database policy (defense-in-depth, see README).
export async function GET() {
  const auth = await getCurrentUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { supabase, userId } = auth;

  const { data, error } = await supabase
    .from("consultations")
    .select("*")
    .eq("student_id", userId)
    .order("scheduled_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ consultations: data });
}

// POST /api/consultations
// Creates a new consultation owned by the authenticated student. student_id
// is always derived from the server-side session, never from the request
// body, so a caller cannot create a booking under someone else's account.
//
// Admins are an oversight-only role and are rejected here regardless of
// what the UI shows or hides — this is the actual enforcement boundary,
// not the page-level redirect in app/dashboard/book/page.tsx.
export async function POST(request: Request) {
  const auth = await getCurrentUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (auth.profile.role !== "student") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { supabase, userId } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { first_name, last_name, reason, scheduled_at } = (body ?? {}) as Record<
    string,
    unknown
  >;

  if (
    typeof first_name !== "string" ||
    !first_name.trim() ||
    typeof last_name !== "string" ||
    !last_name.trim() ||
    typeof reason !== "string" ||
    !reason.trim() ||
    typeof scheduled_at !== "string"
  ) {
    return NextResponse.json(
      { error: "first_name, last_name, reason, and scheduled_at are required" },
      { status: 400 },
    );
  }

  const scheduledDate = new Date(scheduled_at);
  if (Number.isNaN(scheduledDate.getTime())) {
    return NextResponse.json({ error: "scheduled_at is not a valid date" }, { status: 400 });
  }
  if (scheduledDate.getTime() < Date.now()) {
    return NextResponse.json(
      { error: "scheduled_at must be in the future" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("consultations")
    .insert({
      student_id: userId,
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      reason: reason.trim(),
      scheduled_at: scheduledDate.toISOString(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ consultation: data }, { status: 201 });
}
