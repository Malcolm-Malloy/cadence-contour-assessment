"use client";

import { usePathname } from "next/navigation";

// Hides the global site nav on auth pages (login, sign-up, etc.) for a
// clean, focused layout, without needing to restructure app/ into route
// groups. SiteNav itself is an async Server Component rendered by the
// parent layout and passed in as `children` — this just decides whether
// to render that already-server-rendered subtree.
export function NavGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/auth")) {
    return null;
  }
  return <>{children}</>;
}
