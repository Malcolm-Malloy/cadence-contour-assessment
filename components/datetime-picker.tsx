"use client";

import { format, isSameDay, startOfDay } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function DateTimePicker({
  value,
  onChange,
  minDate,
  className,
}: {
  value: Date | undefined;
  onChange: (date: Date) => void;
  minDate?: Date;
  className?: string;
}) {
  function handleDateSelect(day: Date | undefined) {
    if (!day) return;
    const next = new Date(day);
    if (value) {
      next.setHours(value.getHours(), value.getMinutes(), 0, 0);
    } else {
      next.setHours(9, 0, 0, 0);
    }
    onChange(next);
  }

  function handleTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const [hours, minutes] = e.target.value.split(":").map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return;
    const next = new Date(value ?? new Date());
    next.setHours(hours, minutes, 0, 0);
    onChange(next);
  }

  const timeMin = minDate && value && isSameDay(value, minDate) ? format(minDate, "HH:mm") : undefined;

  return (
    <div className={cn("flex gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="flex-1 justify-start font-normal">
            <CalendarIcon className="mr-2 size-4" />
            {value ? format(value, "PPP") : "Pick a date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={handleDateSelect}
            disabled={minDate ? { before: startOfDay(minDate) } : undefined}
            autoFocus
          />
        </PopoverContent>
      </Popover>
      <Input
        type="time"
        className="w-[120px]"
        value={value ? format(value, "HH:mm") : ""}
        min={timeMin}
        onChange={handleTimeChange}
      />
    </div>
  );
}
