import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BookConsultationForm } from "@/components/book-consultation-form";
import { getCurrentUser } from "@/lib/supabase/current-user";

export default function BookConsultationPage() {
  return (
    <Suspense fallback={<BookFallback />}>
      <BookConsultationGate />
    </Suspense>
  );
}

// Admins are an oversight-only role and don't book consultations for
// themselves; this page-level redirect is a UX convenience. The real
// enforcement is in POST /api/consultations, which rejects non-student
// callers regardless of what this page renders.
async function BookConsultationGate() {
  const auth = await getCurrentUser();
  if (!auth) {
    redirect("/auth/login");
  }
  if (auth.profile.role !== "student") {
    redirect("/admin");
  }

  return <BookConsultationForm />;
}

function BookFallback() {
  return (
    <div className="flex-1 w-full flex flex-col gap-8 max-w-md mx-auto">
      <h1 className="font-bold text-2xl">Book a Consultation</h1>
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  );
}
