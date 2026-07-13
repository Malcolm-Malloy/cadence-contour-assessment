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
