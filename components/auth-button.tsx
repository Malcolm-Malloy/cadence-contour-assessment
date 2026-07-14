import Link from "next/link";
import { Button } from "./ui/button";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { LogoutButton } from "./logout-button";

export async function AuthButton() {
  const auth = await getCurrentUser();

  return auth ? (
    <div className="flex items-center gap-4">
      Hey, {auth.profile.first_name} {auth.profile.last_name}!
      <LogoutButton />
    </div>
  ) : (
    <div className="flex gap-2">
      <Button asChild size="sm" variant={"outline"}>
        <Link href="/auth/login">Sign in</Link>
      </Button>
      <Button asChild size="sm" variant={"default"}>
        <Link href="/auth/sign-up">Sign up</Link>
      </Button>
    </div>
  );
}
