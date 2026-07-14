"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateTimePicker } from "@/components/datetime-picker";
import { formatDate, formatTime } from "@/lib/datetime";

export function BookConsultationForm() {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [scheduledAt, setScheduledAt] = useState<Date | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<{ reason: string; scheduledAt: Date } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!scheduledAt) {
      setError("Date and time are required");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason,
          scheduled_at: scheduledAt.toISOString(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Something went wrong");
        return;
      }
      router.refresh();
      setConfirmed({ reason, scheduledAt });
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmed) {
    return (
      <div className="flex-1 w-full flex flex-col gap-6 max-w-md mx-auto text-center items-center">
        <h1 className="font-bold text-2xl">Consultation booked</h1>
        <div className="border rounded-lg p-4 w-full text-left">
          <p className="font-medium">{confirmed.reason}</p>
          <p className="text-sm">{formatDate(confirmed.scheduledAt)}</p>
          <p className="text-sm text-muted-foreground">{formatTime(confirmed.scheduledAt)}</p>
        </div>
        <div className="flex gap-3">
          <Button asChild>
            <Link href="/dashboard">Go to my consultations</Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setConfirmed(null);
              setReason("");
              setScheduledAt(undefined);
            }}
          >
            Book another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full flex flex-col gap-8 max-w-md mx-auto">
      <h1 className="font-bold text-2xl">Book a Consultation</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="reason">Reason for consultation</Label>
          <Input
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="scheduled_at">Date and time</Label>
          <DateTimePicker value={scheduledAt} onChange={setScheduledAt} minDate={new Date()} />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" disabled={submitting}>
          {submitting ? "Booking..." : "Book consultation"}
        </Button>
      </form>
    </div>
  );
}
