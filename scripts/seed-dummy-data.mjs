// Dev/assessment-only helper: seeds 30 dummy student accounts, each with a
// handful of consultations in varied statuses, so the admin view has
// realistic-looking data to review. Not part of the app itself, never
// reachable from a route or API endpoint.
//
// Usage:
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/seed-dummy-data.mjs

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the environment.",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey);

const firstNames = [
  "Alice", "Ben", "Chloe", "Daniel", "Emma", "Felix", "Grace", "Harry",
  "Isla", "Jack", "Katie", "Liam", "Mia", "Noah", "Olivia", "Priya",
  "Quinn", "Ruby", "Sam", "Tara", "Umar", "Violet", "Will", "Xena",
  "Yusuf", "Zara", "Aiden", "Bella", "Caleb", "Delia",
];
const lastNames = [
  "Nguyen", "Smith", "Kaur", "Chen", "Brown", "Patel", "Wilson", "Taylor",
  "Kim", "Lopez", "Anderson", "Murphy", "Singh", "Clarke", "Robinson",
  "Walker", "Young", "Scott", "Green", "Baker", "Adams", "Nelson",
  "Carter", "Mitchell", "Perez", "Roberts", "Turner", "Phillips",
  "Campbell", "Parker",
];
const reasons = [
  "Struggling with essay structure",
  "Need help with exam prep",
  "Time management for assignments",
  "Career pathway advice",
  "Feedback on draft submission",
  "Subject selection guidance",
  "Study plan check-in",
  "Clarifying course requirements",
];

function randomDate(daysOffset) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  d.setHours(9 + Math.floor(Math.random() * 8), Math.random() < 0.5 ? 0 : 30, 0, 0);
  return d.toISOString();
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const STUDENT_COUNT = 30;
const createdStudentIds = [];

console.log(`Creating ${STUDENT_COUNT} dummy students...`);

for (let i = 1; i <= STUDENT_COUNT; i++) {
  const email = `dummy.student${String(i).padStart(2, "0")}@example.com`;

  const { data: existingList } = await supabase.auth.admin.listUsers();
  const existing = existingList.users.find((u) => u.email === email);

  let userId;
  if (existing) {
    userId = existing.id;
    console.log(`  ${email} already exists, reusing.`);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: "DummySeedPass123!",
      email_confirm: true,
    });
    if (error) {
      console.error(`  Failed to create ${email}: ${error.message}`);
      continue;
    }
    userId = data.user.id;
    console.log(`  Created ${email}`);
  }

  createdStudentIds.push(userId);
}

console.log(`Seeding consultations...`);

const statuses = ["booked", "booked", "completed", "cancelled"];
let consultationCount = 0;

for (const studentId of createdStudentIds) {
  const numConsultations = 1 + Math.floor(Math.random() * 3); // 1-3 each

  for (let i = 0; i < numConsultations; i++) {
    const status = pick(statuses);
    const scheduled_at =
      status === "booked" ? randomDate(1 + Math.floor(Math.random() * 20)) : randomDate(-1 - Math.floor(Math.random() * 20));

    const { error } = await supabase.from("consultations").insert({
      student_id: studentId,
      first_name: pick(firstNames),
      last_name: pick(lastNames),
      reason: pick(reasons),
      scheduled_at,
      status,
    });

    if (error) {
      console.error(`  Failed to insert consultation: ${error.message}`);
    } else {
      consultationCount++;
    }
  }
}

console.log(`Done. ${createdStudentIds.length} students, ${consultationCount} consultations seeded.`);
