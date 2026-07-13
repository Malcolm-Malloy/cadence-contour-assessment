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
