export type ConsultationStatus = "booked" | "completed" | "cancelled";

export type Consultation = {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  reason: string;
  scheduled_at: string;
  status: ConsultationStatus;
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  role: "student" | "admin";
  first_name: string;
  last_name: string;
  created_at: string;
};
