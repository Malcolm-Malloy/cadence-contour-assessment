import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
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

  const { supabase, userId, profile } = auth;

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
        <div className="flex items-center gap-2">
          {profile.role === "admin" && (
            <Button variant="outline" asChild>
              <Link href="/admin">Admin view</Link>
            </Button>
          )}
          {profile.role === "student" && (
            <Button asChild>
              <Link href="/dashboard/book">Book a consultation</Link>
            </Button>
          )}
        </div>
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
      <h1 className="font-bold text-2xl">My Consultations</h1>
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  );
}
