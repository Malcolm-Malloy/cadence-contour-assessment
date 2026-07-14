import { LoginForm } from "@/components/login-form";

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Cadence Booking Systems</h1>
          <p className="text-sm text-muted-foreground">Keep every session on schedule.</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
