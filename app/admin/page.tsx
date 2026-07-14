import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { AdminFilters, type StudentOption } from "@/components/admin-filters";
import { formatDate, formatTime } from "@/lib/datetime";
import type { Consultation } from "@/lib/types";

const statusVariant: Record<Consultation["status"], "default" | "secondary" | "destructive"> = {
  booked: "default",
  completed: "secondary",
  cancelled: "destructive",
};

const STATUS_VALUES: Consultation["status"][] = ["booked", "completed", "cancelled"];

function isStatus(value: string | undefined): value is Consultation["status"] {
  return !!value && (STATUS_VALUES as string[]).includes(value);
}

const PAGE_SIZE = 20;

type AdminSearchParams = {
  page?: string;
  dir?: string;
  student?: string;
  status?: string;
};

export default function AdminPage({
  searchParams,
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  return (
    <Suspense fallback={<AdminFallback />}>
      <AdminContent searchParams={searchParams} />
    </Suspense>
  );
}

async function AdminContent({
  searchParams,
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  const auth = await getCurrentUser();
  if (!auth) {
    redirect("/auth/login");
  }
  if (auth.profile.role !== "admin") {
    redirect("/dashboard");
  }

  const { supabase } = auth;

  const {
    page: pageParam,
    dir: dirParam,
    student: studentParam,
    status: statusParam,
  } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const ascending = dirParam !== "desc";
  const studentFilter = studentParam || undefined;
  const statusFilter = isStatus(statusParam) ? statusParam : undefined;
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: studentRows } = await supabase
    .from("consultations")
    .select("student_id, first_name, last_name, created_at")
    .order("created_at", { ascending: false })
    .returns<Pick<Consultation, "student_id" | "first_name" | "last_name" | "created_at">[]>();

  const seen = new Set<string>();
  const students: StudentOption[] = [];
  for (const row of studentRows ?? []) {
    if (seen.has(row.student_id)) continue;
    seen.add(row.student_id);
    students.push({ id: row.student_id, name: `${row.first_name} ${row.last_name}` });
  }
  students.sort((a, b) => a.name.localeCompare(b.name));

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

  const { data: consultations, error, count } = await query
    .range(from, to)
    .returns<Consultation[]>();

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;

  function pageHref(targetPage: number) {
    const params = new URLSearchParams();
    params.set("page", String(targetPage));
    params.set("dir", ascending ? "asc" : "desc");
    if (studentFilter) params.set("student", studentFilter);
    if (statusFilter) params.set("status", statusFilter);
    return `/admin?${params.toString()}`;
  }

  function dateSortHref() {
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("dir", ascending ? "desc" : "asc");
    if (studentFilter) params.set("student", studentFilter);
    if (statusFilter) params.set("status", statusFilter);
    return `/admin?${params.toString()}`;
  }

  return (
    <div className="flex-1 w-full flex flex-col gap-8">
      <h1 className="font-bold text-2xl">All Consultations (Admin)</h1>
      <p className="text-sm text-muted-foreground">
        Read-only view across every student. This page does not support editing.
        {count !== null && count > 0 && ` ${count} total.`}
      </p>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <AdminFilters students={students} />
        <Button variant="outline" size="sm" asChild>
          <Link href={dateSortHref()}>Date {ascending ? "↑" : "↓"}</Link>
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-destructive">Could not load consultations: {error.message}</p>
      ) : consultations && consultations.length > 0 ? (
        <>
          <div className="flex flex-col gap-3">
            {consultations.map((c) => (
              <div key={c.id} className="border rounded-lg p-4 flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <p className="font-medium">
                    {c.first_name} {c.last_name}
                  </p>
                  <p className="text-sm text-muted-foreground">{c.reason}</p>
                  <p className="text-sm">{formatDate(c.scheduled_at)}</p>
                  <p className="text-sm text-muted-foreground">{formatTime(c.scheduled_at)}</p>
                </div>
                <Badge variant={statusVariant[c.status]}>{c.status}</Badge>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              {page <= 1 ? (
                <span
                  aria-disabled
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "pointer-events-none opacity-50")}
                >
                  Previous
                </span>
              ) : (
                <Button variant="outline" size="sm" asChild>
                  <Link href={pageHref(page - 1)}>Previous</Link>
                </Button>
              )}
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              {page >= totalPages ? (
                <span
                  aria-disabled
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "pointer-events-none opacity-50")}
                >
                  Next
                </span>
              ) : (
                <Button variant="outline" size="sm" asChild>
                  <Link href={pageHref(page + 1)}>Next</Link>
                </Button>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          {studentFilter || statusFilter
            ? "No consultations match the selected filters."
            : "No consultations in the system yet."}
        </p>
      )}
    </div>
  );
}

function AdminFallback() {
  return (
    <div className="flex-1 w-full flex flex-col gap-8">
      <h1 className="font-bold text-2xl">All Consultations (Admin)</h1>
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  );
}
