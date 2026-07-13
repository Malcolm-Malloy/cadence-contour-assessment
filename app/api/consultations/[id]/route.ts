import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/current-user";
import type { ConsultationStatus } from "@/lib/types";

type RouteParams = { params: Promise<{ id: string }> };

// PATCH /api/consultations/:id
// Handles reschedule (scheduled_at) and status changes (complete/cancel) for
// a single consultation. Ownership is enforced by filtering on student_id in
// the query itself, on top of the RLS policy, so a student can never
// mutate another student's booking by guessing an id (IDOR protection).
//
// A row that isn't found OR doesn't belong to the caller returns the same
// 404, deliberately, so the response doesn't confirm whether a given id
// exists at all for someone else's account.
export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = await getCurrentUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { supabase, userId } = auth;
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { scheduled_at, status } = (body ?? {}) as Record<string, unknown>;

  // Load the existing row first (scoped to this student) so we can validate
  // the requested transition against its current state.
  const { data: existing, error: fetchError } = await supabase
    .from("consultations")
    .select("*")
    .eq("id", id)
    .eq("student_id", userId)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Consultation not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};

  if (scheduled_at !== undefined) {
    if (existing.status !== "booked") {
      return NextResponse.json(
        { error: "Only booked consultations can be rescheduled" },
        { status: 409 },
      );
    }
    if (typeof scheduled_at !== "string") {
      return NextResponse.json({ error: "scheduled_at must be a string" }, { status: 400 });
    }
    const newDate = new Date(scheduled_at);
    if (Number.isNaN(newDate.getTime())) {
      return NextResponse.json({ error: "scheduled_at is not a valid date" }, { status: 400 });
    }
    if (newDate.getTime() < Date.now()) {
      return NextResponse.json(
        { error: "scheduled_at must be in the future" },
        { status: 400 },
      );
    }
    updates.scheduled_at = newDate.toISOString();
  }

  if (status !== undefined) {
    const allowed: ConsultationStatus[] = ["booked", "completed", "cancelled"];
    if (typeof status !== "string" || !allowed.includes(status as ConsultationStatus)) {
      return NextResponse.json(
        { error: "status must be one of: booked, completed, cancelled" },
        { status: 400 },
      );
    }

    if (status === "completed") {
      if (existing.status !== "booked") {
        return NextResponse.json(
          { error: `Cannot mark complete from status ${existing.status}` },
          { status: 409 },
        );
      }
      if (new Date(existing.scheduled_at).getTime() > Date.now()) {
        // Assumption 5: a consultation can only be marked complete once its
        // scheduled time has passed.
        return NextResponse.json(
          { error: "Cannot mark a future consultation as completed" },
          { status: 409 },
        );
      }
    } else if (status === "booked") {
      // "Mark incomplete": only valid as a revert from completed, not a way
      // to un-cancel — cancelling stays a one-way action.
      if (existing.status !== "completed") {
        return NextResponse.json(
          { error: `Cannot mark incomplete from status ${existing.status}` },
          { status: 409 },
        );
      }
    } else if (status === "cancelled") {
      if (existing.status !== "booked") {
        return NextResponse.json(
          { error: `Cannot cancel from status ${existing.status}` },
          { status: 409 },
        );
      }
    }

    updates.status = status;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "Provide scheduled_at and/or status to update" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("consultations")
    .update(updates)
    .eq("id", id)
    .eq("student_id", userId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ consultation: data });
}
