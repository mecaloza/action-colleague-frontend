export type Role = "admin" | "collaborator";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar?: string;
  department?: string;
  position?: string;
  leader_id?: string;
  leader_name?: string;
  is_active?: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  role: Role;
  department?: string;
  position?: string;
  leader_id?: string;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  role?: Role;
  department?: string;
  position?: string;
  leader_id?: string;
  is_active?: boolean;
}

export interface OrgChartNode {
  id: string | number;
  name: string;
  email?: string;
  position: string;
  department: string;
  role?: string;
  avatar?: string;
  children: OrgChartNode[];
}

export interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  duration_hours: number;
  status: "draft" | "published" | "archived";
  modules: Module[];
  enrolled_count: number;
  completion_rate: number;
  created_at: string;
  updated_at: string;
}

export interface Module {
  id: string;
  course_id: string;
  title: string;
  description: string;
  order: number;
  content_type: "video" | "text" | "quiz" | "assignment";
  duration_minutes: number;
  content?: string;
  quiz?: Quiz;
}

export interface Quiz {
  id: string;
  module_id: string;
  questions: QuizQuestion[];
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct_answer: number;
}

export interface Enrollment {
  id: string;
  user_id: string;
  course_id: string;
  course: Course;
  progress: number;
  status: "enrolled" | "in_progress" | "completed";
  started_at: string;
  completed_at?: string;
  current_module_id?: string;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  position: string;
  hire_date: string;
  training_history: TrainingRecord[];
}

export interface TrainingRecord {
  id: string;
  course_title: string;
  completed_at: string;
  score: number;
  certificate_url?: string;
}

export interface Document {
  id: string;
  title: string;
  type: "offer_letter" | "contract" | "certificate" | "warning" | "promotion";
  status: "draft" | "generated" | "sent" | "signed";
  employee_id?: string;
  employee_name?: string;
  content?: string;
  created_at: string;
  updated_at: string;
}

// Real backend types (no mock fields)
export interface BackendCourse {
  id: number | string;
  title: string;
  description: string;
  status: string;
  created_by: number | string;
  created_at: string;
}

export type GenerationStatus = 'pending' | 'queued' | 'generating' | 'completed' | 'failed';

export interface BackendModule {
  id: number | string;
  course_id: number | string;
  title: string;
  order: number;
  content_text: string | null;
  audio_url: string | null;
  video_url: string | null;
  generation_status: GenerationStatus;
  created_at: string;
}

export interface EvaluationQuestion {
  question: string;
  options: string[];
  correct: number;
}

export interface BackendEvaluation {
  id: number | string;
  module_id: number | string;
  questions_json: string;
}

export interface CourseStats {
  total_modules: number;
  total_evaluations: number;
  total_enrollments: number;
  completion_rate: number;
}

export interface DashboardStats {
  total_courses: number;
  total_employees: number;
  active_enrollments: number;
  completion_rate: number;
  courses_by_category: { category: string; count: number }[];
  recent_completions: { employee: string; course: string; date: string }[];
}

export interface CollaboratorDashboard {
  enrollments: Enrollment[];
  completed_courses: number;
  in_progress_courses: number;
  total_hours: number;
  recent_activity: { action: string; course: string; date: string }[];
}
