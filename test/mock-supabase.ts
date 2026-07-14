import { vi } from "vitest";
import type { Profile } from "@/lib/types";

type MockResult = { data: unknown; error?: unknown; count?: number | null };

type SupabaseQueryBuilder = PromiseLike<{ data: unknown; error: unknown; count?: number | null }> & {
  select: (...args: unknown[]) => SupabaseQueryBuilder;
  eq: (...args: unknown[]) => SupabaseQueryBuilder;
  order: (...args: unknown[]) => SupabaseQueryBuilder;
  range: (...args: unknown[]) => SupabaseQueryBuilder;
  insert: (...args: unknown[]) => SupabaseQueryBuilder;
  update: (...args: unknown[]) => SupabaseQueryBuilder;
  single: () => Promise<{ data: unknown; error: unknown }>;
};

// A minimal fake of the supabase-js fluent query builder. Each call to
// `.from()` consumes the next configured result in `results`, so a route
// that queries twice (e.g. PATCH: fetch-then-update) can be given a
// different result for each call. `insertFn`/`updateFn`/`eqFn` capture the
// actual arguments passed, so tests can assert on *what* was sent to the
// database, not just the HTTP status code that came back.
export function makeSupabaseMock(results: MockResult[]) {
  let call = 0;
  const insertFn = vi.fn();
  const updateFn = vi.fn();
  const eqFn = vi.fn();

  const from = vi.fn(() => {
    const result = results[call] ?? results[results.length - 1] ?? { data: null, error: null };
    call++;

    const resolved = { data: result.data, error: result.error ?? null, count: result.count };

    const builder: SupabaseQueryBuilder = {
      select: () => builder,
      eq: (...args: unknown[]) => {
        eqFn(...args);
        return builder;
      },
      order: () => builder,
      range: () => builder,
      insert: (...args: unknown[]) => {
        insertFn(...args);
        return builder;
      },
      update: (...args: unknown[]) => {
        updateFn(...args);
        return builder;
      },
      single: () => Promise.resolve({ data: resolved.data, error: resolved.error }),
      then: (onfulfilled, onrejected) => Promise.resolve(resolved).then(onfulfilled, onrejected),
    };

    return builder;
  });

  return { from, insertFn, updateFn, eqFn };
}

export function makeAuth({
  userId,
  role,
  firstName = "Test",
  lastName = "User",
  supabase,
}: {
  userId: string;
  role: Profile["role"];
  firstName?: string;
  lastName?: string;
  supabase: ReturnType<typeof makeSupabaseMock>;
}) {
  return {
    supabase,
    userId,
    profile: {
      id: userId,
      role,
      first_name: firstName,
      last_name: lastName,
      created_at: new Date().toISOString(),
    } satisfies Profile,
  };
}
