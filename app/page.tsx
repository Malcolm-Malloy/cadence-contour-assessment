import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/supabase/current-user";

export default async function Home() {
  const auth = await getCurrentUser();
  if (auth) {
    redirect("/dashboard");
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center py-24">
      <h1 className="text-3xl font-bold">Mini LMS</h1>
      <p className="text-muted-foreground max-w-md">
        Book, reschedule, and manage your consultations in one place.
      </p>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/auth/sign-up">Sign up</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/auth/login">Sign in</Link>
        </Button>
      </div>
    </div>
  );
}
