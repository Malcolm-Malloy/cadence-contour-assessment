import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BookConsultationForm } from "@/components/book-consultation-form";
import { Skeleton } from "@/components/ui/skeleton";
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
      <Skeleton className="h-8 w-56" />
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-9 w-full" />
        </div>
        <Skeleton className="h-9 w-full" />
      </div>
    </div>
  );
}
