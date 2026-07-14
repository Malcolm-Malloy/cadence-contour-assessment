export function formatDate(input: string | Date) {
  const d = typeof input === "string" ? new Date(input) : input;
  const weekday = d.toLocaleString("en-AU", { timeZone: "Australia/Melbourne", weekday: "long" });
  const rest = d.toLocaleString("en-AU", {
    timeZone: "Australia/Melbourne",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return `${weekday}, ${rest}`;
}

export function formatTime(input: string | Date) {
  const d = typeof input === "string" ? new Date(input) : input;
  return d.toLocaleString("en-AU", {
    timeZone: "Australia/Melbourne",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
