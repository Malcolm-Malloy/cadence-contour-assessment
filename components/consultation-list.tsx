"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toDatetimeLocalValue } from "@/lib/datetime";
import type { Consultation } from "@/lib/types";

const statusVariant: Record<Consultation["status"], "default" | "secondary" | "destructive"> = {
  booked: "default",
  completed: "secondary",
  cancelled: "destructive",
};

export function ConsultationList({ consultations }: { consultations: Consultation[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [rescheduleValue, setRescheduleValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function patch(id: string, body: Record<string, unknown>) {
    setError(null);
    setPendingId(id);
    try {
      const res = await fetch(`/api/consultations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Something went wrong");
        return;
      }
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  if (consultations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No consultations booked yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-sm text-destructive">{error}</p>}
      {consultations.map((c) => {
        const isPast = new Date(c.scheduled_at).getTime() < Date.now();
        const isBooked = c.status === "booked";
        const isReschedulingThis = reschedulingId === c.id;

        return (
          <div key={c.id} className="border rounded-lg p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <p className="font-medium">
                  {c.first_name} {c.last_name}
                </p>
                <p className="text-sm text-muted-foreground">{c.reason}</p>
              </div>
              <Badge variant={statusVariant[c.status]}>{c.status}</Badge>
            </div>

            <p className="text-sm">
              {new Date(c.scheduled_at).toLocaleString()}
            </p>

            {isReschedulingThis ? (
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  type="datetime-local"
                  value={rescheduleValue}
                  onChange={(e) => setRescheduleValue(e.target.value)}
                  min={toDatetimeLocalValue(new Date())}
                  className="max-w-xs"
                />
                <Button
                  size="sm"
                  disabled={pendingId === c.id || !rescheduleValue}
                  onClick={async () => {
                    await patch(c.id, {
                      scheduled_at: new Date(rescheduleValue).toISOString(),
                    });
                    setReschedulingId(null);
                  }}
                >
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setReschedulingId(null)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              isBooked && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pendingId === c.id}
                    onClick={() => {
                      setRescheduleValue(toDatetimeLocalValue(c.scheduled_at));
                      setReschedulingId(c.id);
                    }}
                  >
                    Reschedule
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pendingId === c.id}
                    onClick={() => patch(c.id, { status: "cancelled" })}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={pendingId === c.id || !isPast}
                    title={!isPast ? "Available once the scheduled time has passed" : undefined}
                    onClick={() => patch(c.id, { status: "completed" })}
                  >
                    Mark complete
                  </Button>
                </div>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}
