import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConsultationList } from "@/components/consultation-list";
import { getCurrentUser } from "@/lib/supabase/current-user";
import type { Consultation } from "@/lib/types";

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <DashboardContent />
    </Suspense>
  );
}

async function DashboardContent() {
  const auth = await getCurrentUser();
  if (!auth) {
    redirect("/auth/login");
  }
  if (auth.profile.role === "admin") {
    redirect("/admin");
  }

  const { supabase, userId } = auth;

  const { data: consultations, error } = await supabase
    .from("consultations")
    .select("*")
    .eq("student_id", userId)
    .order("scheduled_at", { ascending: true })
    .returns<Consultation[]>();

  return (
    <div className="flex-1 w-full flex flex-col gap-8">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="font-bold text-2xl">My Consultations</h1>
        <Button asChild>
          <Link href="/dashboard/book">Book a consultation</Link>
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-destructive">Could not load consultations: {error.message}</p>
      ) : (
        <ConsultationList consultations={consultations ?? []} />
      )}
    </div>
  );
}

function DashboardFallback() {
  return (
    <div className="flex-1 w-full flex flex-col gap-8">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="font-bold text-2xl">My Consultations</h1>
        <Skeleton className="h-9 w-44" />
      </div>
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="border rounded-lg p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
