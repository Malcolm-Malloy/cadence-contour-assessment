import Link from "next/link";
import { Suspense } from "react";
import { AuthButton } from "@/components/auth-button";
import { EnvVarWarning } from "@/components/env-var-warning";
import { hasEnvVars } from "@/lib/utils";
import { getCurrentUser } from "@/lib/supabase/current-user";

export async function SiteNav() {
  const auth = await getCurrentUser();

  return (
    <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
      <div className="w-full max-w-5xl flex justify-between items-center p-3 px-5 text-sm">
        <div className="flex gap-5 items-center font-semibold">
          <Link href="/">Cadence</Link>
          {auth && (
            <div className="flex gap-4 font-normal">
              <Link href="/dashboard">Dashboard</Link>
              <Link href="/dashboard/book">Book</Link>
              {auth.profile.role === "admin" && <Link href="/admin">Admin</Link>}
            </div>
          )}
        </div>
        {!hasEnvVars ? (
          <EnvVarWarning />
        ) : (
          <Suspense>
            <AuthButton />
          </Suspense>
        )}
      </div>
    </nav>
  );
}
