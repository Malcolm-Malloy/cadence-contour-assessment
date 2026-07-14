import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSupabaseMock, makeAuth } from "@/test/mock-supabase";
import { PATCH } from "./route";

const mockGetCurrentUser = vi.fn();
vi.mock("@/lib/supabase/current-user", () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

function futureIso(daysFromNow = 1) {
  return new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString();
}

function pastIso(daysAgo = 1) {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
}

function patchRequest(body: unknown) {
  return new Request("http://localhost/api/consultations/c1", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

function params(id = "c1") {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  mockGetCurrentUser.mockReset();
});

describe("PATCH /api/consultations/:id -- ownership (IDOR)", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await PATCH(patchRequest({ status: "cancelled" }), params());
    expect(res.status).toBe(401);
  });

  it("scopes the ownership check to the caller's own id, and returns 404 for someone else's consultation", async () => {
    // The fetch-then-validate query is scoped by BOTH id and student_id, so a
    // row belonging to a different student resolves to "no row found" here
    // (RLS does the same at the database layer, independently).
    const supabase = makeSupabaseMock([{ data: null, error: { message: "no rows" } }]);
    mockGetCurrentUser.mockResolvedValue(makeAuth({ userId: "student-1", role: "student", supabase }));

    const res = await PATCH(patchRequest({ status: "cancelled" }), params("someone-elses-consultation"));

    expect(res.status).toBe(404);
    expect(supabase.eqFn).toHaveBeenCalledWith("student_id", "student-1");
  });

  it("never reaches the update step when the ownership fetch finds nothing", async () => {
    const supabase = makeSupabaseMock([{ data: null, error: null }]);
    mockGetCurrentUser.mockResolvedValue(makeAuth({ userId: "student-1", role: "student", supabase }));

    await PATCH(patchRequest({ status: "cancelled" }), params());

    expect(supabase.updateFn).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/consultations/:id -- status transition rules", () => {
  function existing(overrides: Partial<{ status: string; scheduled_at: string }> = {}) {
    return {
      id: "c1",
      student_id: "student-1",
      first_name: "A",
      last_name: "B",
      reason: "x",
      status: "booked",
      scheduled_at: futureIso(),
      ...overrides,
    };
  }

  it("rejects an unknown status value", async () => {
    const supabase = makeSupabaseMock([{ data: existing(), error: null }]);
    mockGetCurrentUser.mockResolvedValue(makeAuth({ userId: "student-1", role: "student", supabase }));

    const res = await PATCH(patchRequest({ status: "deleted" }), params());
    expect(res.status).toBe(400);
  });

  it("rejects marking complete a consultation that isn't booked", async () => {
    const supabase = makeSupabaseMock([{ data: existing({ status: "cancelled" }), error: null }]);
    mockGetCurrentUser.mockResolvedValue(makeAuth({ userId: "student-1", role: "student", supabase }));

    const res = await PATCH(patchRequest({ status: "completed" }), params());
    expect(res.status).toBe(409);
  });

  it("rejects marking complete a consultation still in the future", async () => {
    const supabase = makeSupabaseMock([{ data: existing({ scheduled_at: futureIso() }), error: null }]);
    mockGetCurrentUser.mockResolvedValue(makeAuth({ userId: "student-1", role: "student", supabase }));

    const res = await PATCH(patchRequest({ status: "completed" }), params());
    expect(res.status).toBe(409);
  });

  it("allows marking complete a past, booked consultation", async () => {
    const supabase = makeSupabaseMock([
      { data: existing({ scheduled_at: pastIso() }), error: null },
      { data: existing({ scheduled_at: pastIso(), status: "completed" }), error: null },
    ]);
    mockGetCurrentUser.mockResolvedValue(makeAuth({ userId: "student-1", role: "student", supabase }));

    const res = await PATCH(patchRequest({ status: "completed" }), params());
    expect(res.status).toBe(200);
  });

  it("rejects marking incomplete a consultation that isn't completed", async () => {
    const supabase = makeSupabaseMock([{ data: existing({ status: "booked" }), error: null }]);
    mockGetCurrentUser.mockResolvedValue(makeAuth({ userId: "student-1", role: "student", supabase }));

    const res = await PATCH(patchRequest({ status: "booked" }), params());
    expect(res.status).toBe(409);
  });

  it("rejects un-cancelling (cancelled is a one-way terminal state)", async () => {
    const supabase = makeSupabaseMock([{ data: existing({ status: "cancelled" }), error: null }]);
    mockGetCurrentUser.mockResolvedValue(makeAuth({ userId: "student-1", role: "student", supabase }));

    const res = await PATCH(patchRequest({ status: "booked" }), params());
    expect(res.status).toBe(409);
  });

  it("rejects cancelling a consultation that isn't booked", async () => {
    const supabase = makeSupabaseMock([{ data: existing({ status: "completed" }), error: null }]);
    mockGetCurrentUser.mockResolvedValue(makeAuth({ userId: "student-1", role: "student", supabase }));

    const res = await PATCH(patchRequest({ status: "cancelled" }), params());
    expect(res.status).toBe(409);
  });

  it("rejects rescheduling a consultation that isn't booked", async () => {
    const supabase = makeSupabaseMock([{ data: existing({ status: "completed" }), error: null }]);
    mockGetCurrentUser.mockResolvedValue(makeAuth({ userId: "student-1", role: "student", supabase }));

    const res = await PATCH(patchRequest({ scheduled_at: futureIso() }), params());
    expect(res.status).toBe(409);
  });

  it("rejects rescheduling into the past", async () => {
    const supabase = makeSupabaseMock([{ data: existing(), error: null }]);
    mockGetCurrentUser.mockResolvedValue(makeAuth({ userId: "student-1", role: "student", supabase }));

    const res = await PATCH(patchRequest({ scheduled_at: pastIso() }), params());
    expect(res.status).toBe(400);
  });

  it("allows a valid reschedule", async () => {
    const newDate = futureIso(5);
    const supabase = makeSupabaseMock([
      { data: existing(), error: null },
      { data: existing({ scheduled_at: newDate }), error: null },
    ]);
    mockGetCurrentUser.mockResolvedValue(makeAuth({ userId: "student-1", role: "student", supabase }));

    const res = await PATCH(patchRequest({ scheduled_at: newDate }), params());

    expect(res.status).toBe(200);
    expect(supabase.updateFn).toHaveBeenCalledWith(expect.objectContaining({ scheduled_at: newDate }));
  });
});
