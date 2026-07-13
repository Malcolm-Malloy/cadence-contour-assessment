import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getCurrentUser } from "@/lib/supabase/current-user";
import type { Consultation } from "@/lib/types";

const statusVariant: Record<Consultation["status"], "default" | "secondary" | "destructive"> = {
  booked: "default",
  completed: "secondary",
  cancelled: "destructive",
};

const PAGE_SIZE = 20;

const SORT_KEYS = ["scheduled_at", "student", "status"] as const;
type SortKey = (typeof SORT_KEYS)[number];

function isSortKey(value: string | undefined): value is SortKey {
  return !!value && (SORT_KEYS as readonly string[]).includes(value);
}

type AdminSearchParams = { page?: string; sort?: string; dir?: string };

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

// Admin-only, read-only list of every consultation in the system.
//
// The role check below is a page-level convenience redirect for UX — a
// non-admin who somehow lands here is bounced back to their dashboard. It is
// NOT the security boundary. The actual enforcement is server-side in
// /api/admin/consultations and in the `consultations_select_admin` RLS
// policy, both of which re-derive the caller's role from their session
// independently of this page. See README "Assumptions & Justifications", #2.
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

  const { page: pageParam, sort: sortParam, dir: dirParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const sort: SortKey = isSortKey(sortParam) ? sortParam : "scheduled_at";
  const ascending = dirParam !== "desc";
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

  const { data: consultations, error, count } = await query
    .range(from, to)
    .returns<Consultation[]>();

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;

  function pageHref(targetPage: number) {
    return `/admin?page=${targetPage}&sort=${sort}&dir=${ascending ? "asc" : "desc"}`;
  }

  function sortHref(key: SortKey) {
    const nextDir = sort === key && ascending ? "desc" : "asc";
    return `/admin?page=1&sort=${key}&dir=${nextDir}`;
  }

  function sortIndicator(key: SortKey) {
    if (sort !== key) return null;
    return ascending ? " ↑" : " ↓";
  }

  return (
    <div className="flex-1 w-full flex flex-col gap-8">
      <h1 className="font-bold text-2xl">All Consultations (Admin)</h1>
      <p className="text-sm text-muted-foreground">
        Read-only view across every student. This page does not support editing.
        {count !== null && count > 0 && ` ${count} total.`}
      </p>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">Sort by:</span>
        <Button variant={sort === "scheduled_at" ? "default" : "outline"} size="sm" asChild>
          <Link href={sortHref("scheduled_at")}>Date{sortIndicator("scheduled_at")}</Link>
        </Button>
        <Button variant={sort === "student" ? "default" : "outline"} size="sm" asChild>
          <Link href={sortHref("student")}>Student{sortIndicator("student")}</Link>
        </Button>
        <Button variant={sort === "status" ? "default" : "outline"} size="sm" asChild>
          <Link href={sortHref("status")}>Status{sortIndicator("status")}</Link>
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
                  <p className="text-sm">{new Date(c.scheduled_at).toLocaleString()}</p>
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
        <p className="text-sm text-muted-foreground">No consultations in the system yet.</p>
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
