import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/current-user";

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

export async function POST(request: Request) {
  const auth = await getCurrentUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (auth.profile.role !== "student") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { supabase, userId, profile } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { reason, scheduled_at } = (body ?? {}) as Record<string, unknown>;

  if (
    typeof reason !== "string" ||
    !reason.trim() ||
    typeof scheduled_at !== "string"
  ) {
    return NextResponse.json(
      { error: "reason and scheduled_at are required" },
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
      first_name: profile.first_name,
      last_name: profile.last_name,
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
