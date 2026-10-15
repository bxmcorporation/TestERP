export type Unit = {
  id: string;
  name: string;
  code: string;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  config: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type Course = {
  id: string;
  name: string;
  description: string | null;
  duration_hours: number | null;
  modality: string;
  status: string;
  unit_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Teacher = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  specialty: string | null;
  hire_date: string | null;
  status: string;
  unit_id: string | null;
  availability: unknown[] | null;
  created_at: string;
  updated_at: string;
};

export type Room = {
  id: string;
  name: string;
  code: string | null;
  capacity: number;
  unit_id: string | null;
  status: string;
  created_at: string;
};

export type Guardian = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  document_cpf: string | null;
  relationship_type: string | null;
  is_financial_responsible: boolean;
  status: string;
  unit_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Student = {
  id: string;
  code: string;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  academic_status: string;
  course_id: string | null;
  unit_id: string | null;
  photo_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type StudentGuardian = {
  id: string;
  student_id: string;
  guardian_id: string;
  relationship_type: string;
  is_primary: boolean;
  is_financial: boolean;
  created_at: string;
};

export type Enrollment = {
  id: string;
  code: string;
  student_id: string;
  course_id: string;
  unit_id: string | null;
  status: string;
  enrollment_date: string;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Class = {
  id: string;
  code: string;
  name: string;
  course_id: string;
  unit_id: string | null;
  room_id: string | null;
  status: string;
  min_capacity: number;
  max_capacity: number;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
};

export type ClassTeacher = {
  id: string;
  class_id: string;
  teacher_id: string;
  role: string;
  created_at: string;
};

export type ClassStudent = {
  id: string;
  class_id: string;
  student_id: string;
  enrollment_date: string;
  status: string;
  created_at: string;
};

export type Schedule = {
  id: string;
  class_id: string;
  teacher_id: string;
  room_id: string | null;
  weekday: number;
  start_time: string;
  end_time: string;
  status: string;
  created_at: string;
};

export type Lesson = {
  id: string;
  class_id: string;
  teacher_id: string;
  title: string;
  lesson_date: string;
  start_time: string;
  end_time: string;
  objective: string | null;
  content: string | null;
  status: string;
  observations: string | null;
  created_at: string;
  updated_at: string;
};

export type Attendance = {
  id: string;
  lesson_id: string;
  student_id: string;
  status: string;
  justification: string | null;
  recorded_at: string;
};

export type FinancialItem = {
  id: string;
  code: string;
  description: string;
  type: string;
  category: string | null;
  amount: number;
  due_date: string | null;
  paid_date: string | null;
  status: string;
  student_id: string | null;
  unit_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Activity = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
};

export type DatabaseRecord = {
  [key: string]: unknown;
};
