// toLocaleString() with no explicit locale/timeZone uses the runtime's
// defaults, which can differ between the Node.js SSR process (often UTC
// on hosting platforms) and the browser (the viewer's local timezone),
// producing a hydration mismatch: server and client render different text
// for the same Date. Pinning both here makes the output deterministic
// regardless of where the server process runs.
//
// A fixed timezone also means every viewer sees the same wall-clock time
// for a consultation slot rather than a value that shifts with their own
// browser's timezone — the correct behaviour for a school's scheduled
// sessions, not just a hydration workaround.
export function formatDateTime(input: string | Date) {
  const d = typeof input === "string" ? new Date(input) : input;
  return d.toLocaleString("en-AU", {
    timeZone: "Australia/Melbourne",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
