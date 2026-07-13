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
const PAGE_SIZE = 20;

const SORT_KEYS = ["scheduled_at", "student", "status"] as const;
type SortKey = (typeof SORT_KEYS)[number];

function isSortKey(value: string | null): value is SortKey {
  return !!value && (SORT_KEYS as readonly string[]).includes(value);
}

export async function GET(request: Request) {
  const auth = await getCurrentUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (auth.profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { supabase } = auth;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const sortParam = searchParams.get("sort");
  const sort: SortKey = isSortKey(sortParam) ? sortParam : "scheduled_at";
  const ascending = searchParams.get("dir") !== "desc";
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase.from("consultations").select("*", { count: "exact" });
  if (sort === "student") {
    query = query.order("last_name", { ascending }).order("first_name", { ascending });
  } else if (sort === "status") {
    query = query.order("status", { ascending });
  } else {
    query = query.order("scheduled_at", { ascending });
  }
  // Tie-breaker so row order (and thus pagination) stays deterministic
  // across requests when the primary sort key has duplicate values.
  query = query.order("id", { ascending: true });

  const { data, error, count } = await query.range(from, to);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    consultations: data,
    page,
    pageSize: PAGE_SIZE,
    total: count ?? 0,
    totalPages: count ? Math.ceil(count / PAGE_SIZE) : 1,
    sort,
    dir: ascending ? "asc" : "desc",
  });
}
