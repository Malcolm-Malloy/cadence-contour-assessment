// Dev/assessment-only helper: promotes an already-signed-up user to the
// 'admin' role so the Admin view (/admin) can actually be exercised.
//
// This is intentionally NOT part of the app itself and is never reachable
// from a route or API endpoint — it's a one-off script run from the
// terminal, using the service role key (which bypasses RLS), precisely so
// that key never has to touch application code or the browser.
//
// Usage:
//   SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_SUPABASE_URL=... \
//     node scripts/promote-admin.mjs someone@example.com

import { createClient } from "@supabase/supabase-js";

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/promote-admin.mjs <email>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the environment.",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey);

const { data: userList, error: listError } = await supabase.auth.admin.listUsers();
if (listError) {
  console.error("Failed to list users:", listError.message);
  process.exit(1);
}

const user = userList.users.find((u) => u.email === email);
if (!user) {
  console.error(`No user found with email ${email}. Sign up through the app first.`);
  process.exit(1);
}

const { error: updateError } = await supabase
  .from("profiles")
  .update({ role: "admin" })
  .eq("id", user.id);

if (updateError) {
  console.error("Failed to promote user:", updateError.message);
  process.exit(1);
}

console.log(`${email} promoted to admin.`);
