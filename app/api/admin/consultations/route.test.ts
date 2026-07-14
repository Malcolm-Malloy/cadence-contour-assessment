import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSupabaseMock, makeAuth } from "@/test/mock-supabase";
import { GET } from "./route";

const mockGetCurrentUser = vi.fn();
vi.mock("@/lib/supabase/current-user", () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

function getRequest(query = "") {
  return new Request(`http://localhost/api/admin/consultations${query}`);
}

beforeEach(() => {
  mockGetCurrentUser.mockReset();
});

describe("GET /api/admin/consultations", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET(getRequest());
    expect(res.status).toBe(401);
  });

  it("returns 403 for an authenticated non-admin (student) caller", async () => {
    const supabase = makeSupabaseMock([]);
    mockGetCurrentUser.mockResolvedValue(makeAuth({ userId: "student-1", role: "student", supabase }));

    const res = await GET(getRequest());

    expect(res.status).toBe(403);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("allows an admin caller and returns paginated results", async () => {
    const supabase = makeSupabaseMock([{ data: [{ id: "c1" }, { id: "c2" }], error: null, count: 2 }]);
    mockGetCurrentUser.mockResolvedValue(makeAuth({ userId: "admin-1", role: "admin", supabase }));

    const res = await GET(getRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.total).toBe(2);
    expect(json.consultations).toHaveLength(2);
  });

  it("applies the student filter from the query string", async () => {
    const supabase = makeSupabaseMock([{ data: [], error: null, count: 0 }]);
    mockGetCurrentUser.mockResolvedValue(makeAuth({ userId: "admin-1", role: "admin", supabase }));

    await GET(getRequest("?student=some-student-id"));

    expect(supabase.eqFn).toHaveBeenCalledWith("student_id", "some-student-id");
  });
});
