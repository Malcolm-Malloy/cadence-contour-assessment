"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { Consultation } from "@/lib/types";

const selectClassName =
  "h-8 rounded-md border border-input bg-background px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export type StudentOption = { id: string; name: string };

export function AdminFilters({ students }: { students: StudentOption[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParam(key: "student" | "status", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.set("page", "1");
    router.push(`/admin?${params.toString()}`);
  }

  const statuses: Consultation["status"][] = ["booked", "completed", "cancelled"];

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        Student:
        <select
          className={selectClassName}
          value={searchParams.get("student") ?? ""}
          onChange={(e) => updateParam("student", e.target.value)}
        >
          <option value="">All students</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        Status:
        <select
          className={selectClassName}
          value={searchParams.get("status") ?? ""}
          onChange={(e) => updateParam("status", e.target.value)}
        >
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
