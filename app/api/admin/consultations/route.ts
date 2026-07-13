import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/current-user";

const PAGE_SIZE = 20;

const STATUS_VALUES = ["booked", "completed", "cancelled"] as const;
type StatusValue = (typeof STATUS_VALUES)[number];

function isStatus(value: string | null): value is StatusValue {
  return !!value && (STATUS_VALUES as readonly string[]).includes(value);
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
  const ascending = searchParams.get("dir") !== "desc";
  const studentFilter = searchParams.get("student") || undefined;
  const statusParam = searchParams.get("status");
  const statusFilter = isStatus(statusParam) ? statusParam : undefined;
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase.from("consultations").select("*", { count: "exact" });
  if (studentFilter) {
    query = query.eq("student_id", studentFilter);
  }
  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }
  query = query
    .order("scheduled_at", { ascending })
    .order("id", { ascending: true });

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
    dir: ascending ? "asc" : "desc",
    student: studentFilter ?? null,
    status: statusFilter ?? null,
  });
}
