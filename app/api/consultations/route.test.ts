import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSupabaseMock, makeAuth } from "@/test/mock-supabase";
import { GET, POST } from "./route";

const mockGetCurrentUser = vi.fn();
vi.mock("@/lib/supabase/current-user", () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

function futureIso() {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
}

function pastIso() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}

function postRequest(body: unknown) {
  return new Request("http://localhost/api/consultations", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockGetCurrentUser.mockReset();
});

describe("GET /api/consultations", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("scopes the query to the caller's own student_id", async () => {
    const supabase = makeSupabaseMock([{ data: [], error: null }]);
    mockGetCurrentUser.mockResolvedValue(makeAuth({ userId: "student-1", role: "student", supabase }));

    const res = await GET();

    expect(res.status).toBe(200);
    expect(supabase.eqFn).toHaveBeenCalledWith("student_id", "student-1");
  });
});

describe("POST /api/consultations", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(postRequest({ reason: "x", scheduled_at: futureIso() }));
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-student caller (admins cannot book)", async () => {
    const supabase = makeSupabaseMock([]);
    mockGetCurrentUser.mockResolvedValue(makeAuth({ userId: "admin-1", role: "admin", supabase }));

    const res = await POST(postRequest({ reason: "x", scheduled_at: futureIso() }));

    expect(res.status).toBe(403);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("rejects a missing reason", async () => {
    const supabase = makeSupabaseMock([]);
    mockGetCurrentUser.mockResolvedValue(makeAuth({ userId: "student-1", role: "student", supabase }));

    const res = await POST(postRequest({ scheduled_at: futureIso() }));

    expect(res.status).toBe(400);
  });

  it("rejects a past scheduled_at", async () => {
    const supabase = makeSupabaseMock([]);
    mockGetCurrentUser.mockResolvedValue(makeAuth({ userId: "student-1", role: "student", supabase }));

    const res = await POST(postRequest({ reason: "x", scheduled_at: pastIso() }));

    expect(res.status).toBe(400);
  });

  it("derives first_name/last_name from the profile, ignoring any client-supplied name", async () => {
    const supabase = makeSupabaseMock([
      {
        data: { id: "c1", first_name: "Real", last_name: "Name", reason: "x", scheduled_at: futureIso(), status: "booked" },
        error: null,
      },
    ]);
    mockGetCurrentUser.mockResolvedValue(
      makeAuth({ userId: "student-1", role: "student", firstName: "Real", lastName: "Name", supabase }),
    );

    const res = await POST(
      postRequest({
        first_name: "Spoofed",
        last_name: "Attacker",
        reason: "x",
        scheduled_at: futureIso(),
      }),
    );

    expect(res.status).toBe(201);
    expect(supabase.insertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        student_id: "student-1",
        first_name: "Real",
        last_name: "Name",
      }),
    );
  });
});
