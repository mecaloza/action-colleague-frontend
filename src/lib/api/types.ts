// Types of the v1 API: a mirror of the backend's schemas (app/schemas/*).

export type CourseStatus = "draft" | "published" | "archived";
export type CourseSource = "ai" | "manual";
export type ModuleSource = "ai" | "upload" | "recording" | "text" | "document";
export type GenerationStatus = "pending" | "queued" | "generating" | "completed" | "failed";
export type EnrollmentStatus = "assigned" | "in_progress" | "completed";
export type Language = "es" | "en" | "pt";

export interface MediaRef {
  url: string;
  mime_type: string;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
}

export interface CourseSettings {
  tone: string;
  audience: string;
  voice_id: string;
  voice_name: string;
  avatar_id: string;
  avatar_name: string;
  presenter: boolean;
  theme: "dark" | "light";
}

export interface CourseSummary {
  id: number;
  title: string;
  description: string;
  language: Language;
  status: CourseStatus;
  source: CourseSource;
  module_count: number;
  enrolled_count: number;
  completed_count: number;
  completion_rate: number;
  generating_count: number;
  cover_url: string | null;
  created_at: string | null;
  updated_at: string | null;
  published_at: string | null;
}

export interface EvaluationSummary {
  question_count: number;
  max_attempts: number;
  passing_score: number;
}

export interface ModuleAdmin {
  id: number;
  course_id: number;
  title: string;
  description: string;
  order: number;
  source: ModuleSource;
  content_text: string;
  generation_status: GenerationStatus;
  generation_error: string | null;
  video: MediaRef | null;
  poster_url: string | null;
  captions_url: string | null;
  document: MediaRef | null;
  duration_seconds: number | null;
  scene_count: number;
  evaluation: EvaluationSummary | null;
  updated_at: string | null;
}

export interface CourseDetail extends CourseSummary {
  settings: CourseSettings;
  modules: ModuleAdmin[];
}

export interface PublishProblem {
  module_id: number | null;
  message: string;
}

// Canonical questions (admin, with answers)
interface QuestionBase {
  id: string;
  prompt: string;
  explanation: string;
}
export interface SingleChoiceQuestion extends QuestionBase {
  type: "single_choice";
  scenario: string;
  options: string[];
  correct_index: number;
}
export interface TrueFalseQuestion extends QuestionBase {
  type: "true_false";
  correct: boolean;
}
export interface OrderingQuestion extends QuestionBase {
  type: "ordering";
  items: string[];
}
export interface MatchingQuestion extends QuestionBase {
  type: "matching";
  pairs: { left: string; right: string }[];
}
export interface FillBlankQuestion extends QuestionBase {
  type: "fill_blank";
  answers: string[];
  hint: string;
}
export type Question = SingleChoiceQuestion | TrueFalseQuestion | OrderingQuestion | MatchingQuestion | FillBlankQuestion;
export type QuestionType = Question["type"];

export interface EvaluationAdmin {
  id: number;
  module_id: number;
  questions: Question[];
  max_attempts: number;
  passing_score: number;
}

export interface Participant {
  enrollment_id: number;
  user: { id: number; name: string; email: string; position: string; department: string };
  status: EnrollmentStatus;
  progress_pct: number;
  completed_modules: number;
  total_modules: number;
  average_score: number | null;
  enrolled_at: string | null;
  completed_at: string | null;
  last_activity_at: string | null;
}

export interface QuestionAnalytics {
  question_id: string;
  prompt: string;
  type: QuestionType;
  responses: number;
  correct: number;
  accuracy: number | null;
}

export interface ModuleAnalytics {
  module_id: number;
  title: string;
  attempts: number;
  learners: number;
  pass_rate: number;
  average_score: number | null;
  questions: QuestionAnalytics[];
}

export interface AttemptDetail {
  attempt_number: number;
  score: number | null;
  passed: boolean;
  created_at: string | null;
  results: { question_id: string; prompt: string; correct: boolean }[];
}

export interface ModuleAttempts {
  module_id: number;
  module_title: string;
  attempts: AttemptDetail[];
}

export type Role = "admin" | "collaborator";

export interface UserRow {
  id: number;
  name: string;
  email: string;
  role: Role;
  position: string;
  department: string;
  is_active: boolean;
  created_at: string | null;
  enrolled_count: number;
  completed_count: number;
}

export interface Dashboard {
  courses: { total: number; published: number; draft: number; generating: number };
  learners: { total: number; active_30d: number };
  enrollments: { total: number; completed: number; in_progress: number };
  completion_rate: number;
  average_score: number | null;
  recent_activity: {
    kind: "passed_quiz" | "failed_quiz" | "completed_course";
    user_name: string;
    course_id: number;
    course_title: string;
    module_title: string | null;
    score: number | null;
    at: string | null;
  }[];
  top_courses: { id: number; title: string; enrolled_count: number; completion_rate: number }[];
}

// Learner
export interface LearnerCourse {
  course_id: number;
  title: string;
  description: string;
  cover_url: string | null;
  status: EnrollmentStatus;
  progress_pct: number;
  total_modules: number;
  completed_modules: number;
  next_module_id: number | null;
  next_module_title: string | null;
  total_duration_seconds: number;
  enrolled_at: string | null;
  completed_at: string | null;
}

export interface QuizSummary {
  question_count: number;
  max_attempts: number;
  attempts_used: number;
  passed: boolean;
  best_score: number | null;
  passing_score: number;
}

export interface LearnerModule {
  id: number;
  title: string;
  description: string;
  order: number;
  source: ModuleSource;
  unlocked: boolean;
  completed: boolean;
  duration_seconds: number | null;
  video: MediaRef | null;
  poster_url: string | null;
  captions_url: string | null;
  document: MediaRef | null;
  content_text: string | null;
  last_position_seconds: number;
  quiz: QuizSummary | null;
}

export interface LearnerCourseDetail {
  course: { id: number; title: string; description: string; language: Language };
  enrollment: { id: number; status: EnrollmentStatus; progress_pct: number; completed_at: string | null } | null;
  modules: LearnerModule[];
}

export interface Choice {
  id: string;
  text: string;
}

export type LearnerQuestion =
  | { id: string; type: "single_choice"; prompt: string; scenario: string; options: Choice[] }
  | { id: string; type: "true_false"; prompt: string }
  | { id: string; type: "ordering"; prompt: string; items: Choice[] }
  | { id: string; type: "matching"; prompt: string; lefts: Choice[]; rights: Choice[] }
  | { id: string; type: "fill_blank"; prompt: string; hint: string };

export interface LearnerQuiz {
  module_id: number;
  questions: LearnerQuestion[];
  max_attempts: number;
  attempts_used: number;
  passing_score: number;
  passed: boolean;
}

export type QuizResponse =
  | { option: string }
  | { value: boolean }
  | { order: string[] }
  | { matches: Record<string, string> }
  | { text: string };

export interface AttemptResult {
  score: number;
  passed: boolean;
  correct: number;
  total: number;
  attempts_used: number;
  attempts_remaining: number;
  results: { question_id: string; correct: boolean; explanation: string; expected: unknown }[];
  module_completed: boolean;
  next_module_id: number | null;
  course_completed: boolean;
}

export interface CompletionResult {
  module_completed: boolean;
  next_module_id: number | null;
  course_completed: boolean;
}

// Media and background jobs
export type MediaKind = "video" | "recording" | "document" | "deck" | "image" | "audio";
export type MediaPurpose = "module_video" | "recording" | "module_document" | "course_cover" | "course_material" | "deck";
export type MediaStatus = "pending" | "uploaded" | "processing" | "ready" | "failed";

export interface MediaAsset {
  id: string;
  kind: MediaKind;
  status: MediaStatus;
  mime_type: string;
  size_bytes: number | null;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  original_filename: string | null;
  course_id: number | null;
  url: string | null;
  error: string | null;
  pages: string[];
  text_chars: number | null;
  created_at: string | null;
}

export interface UploadTarget {
  method: "PUT" | "TUS";
  url: string;
  headers: Record<string, string>;
  metadata: Record<string, string>;
  chunk_size: number | null;
}

export interface Job {
  id: string;
  type: string;
  status: "queued" | "running" | "succeeded" | "failed" | "canceled";
  progress: number;
  step: string;
  error: string | null;
  course_id: number | null;
  module_id: number | null;
  result: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
}
