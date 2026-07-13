import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/supabase/current-user";
import type { Consultation } from "@/lib/types";

const statusVariant: Record<Consultation["status"], "default" | "secondary" | "destructive"> = {
  booked: "default",
  completed: "secondary",
  cancelled: "destructive",
};

export default function AdminPage() {
  return (
    <Suspense fallback={<AdminFallback />}>
      <AdminContent />
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
async function AdminContent() {
  const auth = await getCurrentUser();
  if (!auth) {
    redirect("/auth/login");
  }
  if (auth.profile.role !== "admin") {
    redirect("/dashboard");
  }

  const { supabase } = auth;

  const { data: consultations, error } = await supabase
    .from("consultations")
    .select("*")
    .order("scheduled_at", { ascending: true })
    .returns<Consultation[]>();

  return (
    <div className="flex-1 w-full flex flex-col gap-8">
      <h1 className="font-bold text-2xl">All Consultations (Admin)</h1>
      <p className="text-sm text-muted-foreground">
        Read-only view across every student. This page does not support editing.
      </p>

      {error ? (
        <p className="text-sm text-destructive">Could not load consultations: {error.message}</p>
      ) : consultations && consultations.length > 0 ? (
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
