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
  /** What the admin asked the AI studio for (kept to resume and to regenerate). */
  brief: string;
  minutes: number;
  /** Modules the admin asked for; null lets the AI choose. */
  modules?: number | null;
  voice_id: string;
  voice_name: string;
  avatar_id: string;
  avatar_name: string;
  /** A second presenter who takes turns with the first, with a voice of its own ("" = none). */
  co_avatar_id?: string;
  co_avatar_name?: string;
  co_voice_id?: string;
  co_voice_name?: string;
  /** HeyGen engine: "" the server's default, "avatar_iv" more natural (about 4× the cost). */
  avatar_engine?: AvatarEngine;
  /** "high": every scene with a visual is an animated clip (costs more). */
  animation?: Animation;
  presenter: boolean;
  theme: SlideTheme;
}

export type AvatarEngine = "" | "avatar_iii" | "avatar_iv";
export type Animation = "" | "high";

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
  /** Something the AI video came out without, and why (e.g. its presenter). */
  video_warning: string | null;
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

/** A role in the company ("Asesor de flotas"): its people get the learning paths linked to it. */
export interface ProfileRef {
  id: number;
  name: string;
}

export interface ProfileItem extends ProfileRef {
  description: string;
  /** Everyone with the profile (any role, active or not). */
  user_count: number;
  /** Paths linked to it, whatever their status. */
  path_count: number;
}

export interface UserRow {
  id: number;
  name: string;
  email: string;
  role: Role;
  position: string;
  department: string;
  profile: ProfileRef | null;
  is_active: boolean;
  created_at: string | null;
  enrolled_count: number;
  completed_count: number;
}

// Learning paths: courses in an order for the people of some profiles, and whoever is assigned by hand.
export type PathStatus = "draft" | "published" | "archived";
/** How a person got a path: their profile, or an admin by hand (that one stays whatever their profile). */
export type AssignmentSource = "profile" | "manual";
/** A person's progress in a path ("overdue": not completed and past its deadline). */
export type JourneyStatus = "not_started" | "in_progress" | "completed" | "overdue";
/** A person's state in one course of a path. */
export type StepStatus = "completed" | "in_progress" | "available" | "locked";

export interface PathSettings {
  /** Each course opens once the previous one (published) is completed. */
  sequential: boolean;
  /** Days to finish the path from the day it is assigned (null: no deadline). */
  due_days: number | null;
  certificate: boolean;
}

export interface CourseRef {
  course_id: number;
  title: string;
}

export interface PathRef {
  id: number;
  title: string;
}

/** Where a course sits in the learner's path: `step` of `steps` (its published courses). */
export interface CoursePath extends PathRef {
  step: number;
  steps: number;
}

export interface PathRow {
  id: number;
  title: string;
  description: string;
  status: PathStatus;
  /** Every course of the path, whatever its status. */
  course_count: number;
  profiles: ProfileRef[];
  people_count: number;
  completed_count: number;
  completion_rate: number;
  updated_at: string | null;
}

export interface PathCourse {
  course_id: number;
  title: string;
  status: CourseStatus;
  module_count: number;
  /** 1-based position in the path. */
  order: number;
  cover_url: string | null;
}

export interface PathDetail {
  id: number;
  title: string;
  description: string;
  status: PathStatus;
  settings: PathSettings;
  profiles: ProfileRef[];
  /** In path order, every status (learners only see the published ones). */
  courses: PathCourse[];
  people_count: number;
  completed_count: number;
  published_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface PathPerson {
  user: { id: number; name: string; email: string; position: string; department: string; profile: ProfileRef | null };
  source: AssignmentSource;
  /** False while their profile gives them the path (whatever the source): it is taken away by changing the profile. */
  removable: boolean;
  assigned_at: string | null;
  due_at: string | null;
  completed_at: string | null;
  status: JourneyStatus;
  progress_pct: number;
  current_course_id: number | null;
  /** The path's published courses, in order. */
  steps: { course_id: number; status: StepStatus; progress_pct: number }[];
}

export interface LearnerPathStep {
  course_id: number;
  title: string;
  cover_url: string | null;
  status: StepStatus;
  progress_pct: number;
  total_modules: number;
  completed_modules: number;
  /** The course to complete first (while locked). */
  locked_by: CourseRef | null;
}

export interface LearnerPath {
  id: number;
  title: string;
  description: string;
  status: JourneyStatus;
  progress_pct: number;
  assigned_at: string | null;
  due_at: string | null;
  completed_at: string | null;
  /** The course to go on with: the first one neither completed nor locked (null once the path is completed). */
  current_course_id: number | null;
  /** Its published courses, in order. */
  steps: LearnerPathStep[];
}

/** What completing a course opened in the learner's paths (both null until the course is completed). */
export interface PathOutcome {
  /** The next course of its path, now available. */
  next_course: CourseRef | null;
  /** The path this course completed. */
  path_completed: PathRef | null;
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
  /** Kept closed by a sequential learning path until `locked_by` is completed. */
  locked: boolean;
  locked_by: CourseRef | null;
  /** The first of the learner's paths with this course. */
  path: CoursePath | null;
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
  /** Published interactive activities, played after the video (only for unlocked modules). */
  activities: LearnerActivitySummary[];
}

// Interactive activities

export type ActivityType = "decision" | "inspection" | "simulator" | "quick";

export interface LearnerActivitySummary {
  id: number;
  type: ActivityType;
  title: string;
  intro: string;
  finished: boolean;
  best_score: number | null;
  max_score: number;
  /** An open play that can go on: starting the activity picks it up where it was left. */
  resumable: boolean;
}

interface ActivityViewBase {
  type: ActivityType;
  title: string;
  intro: string;
  score: number;
  max_score: number;
  done: boolean;
}

export interface DecisionNode {
  /** Narration key of the situation. */
  line: string;
  speaker: string;
  situation: string;
  choices: { token: string; text: string }[];
}

export interface DecisionStep {
  situation: string;
  /** Who said the situation (missing in steps played before it was recorded). */
  speaker?: string;
  choice: string;
  feedback: string;
  points: number;
  /** The best answer's points at that step, told after choosing (missing in steps played before it was). */
  best_points?: number;
  line: string;
}

export interface DecisionView extends ActivityViewBase {
  type: "decision";
  step: number;
  path: DecisionStep[];
  node: DecisionNode | null;
}

/** How a tire is drawn: its wear pattern or damage ("none": not a tire). */
export type TireLook = "none" | "even" | "center" | "shoulders" | "one_side" | "cupping" | "cuts" | "bulge";

export interface InspectionVerdict {
  id: string;
  label: string;
}

/** The right answer for an item: only once the learner decided on it (or the play is over). */
export interface InspectionOutcome {
  answer: string;
  answer_label: string;
  explanation: string;
  /** Narration key of the explanation. */
  line: string;
  correct: boolean;
}

export interface InspectionItem {
  id: string;
  label: string;
  facts: { label: string; value: string }[];
  look: TireLook;
  /** The verdict the learner chose (null: not decided yet). */
  chosen: string | null;
  outcome: InspectionOutcome | null;
}

export interface InspectionView extends ActivityViewBase {
  type: "inspection";
  prompt: string;
  scene: "truck" | "cards";
  lives: number;
  max_lives: number;
  streak: number;
  verdicts: InspectionVerdict[];
  items: InspectionItem[];
}

export interface SimulatorVariable {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

export interface SimulatorTarget {
  op: "lte" | "gte" | "between";
  value: number;
  value2: number;
}

export interface SimulatorTry {
  values: Record<string, number>;
  result: number;
  met: boolean;
}

export interface SimulatorView extends ActivityViewBase {
  type: "simulator";
  prompt: string;
  hint: string;
  formula: string;
  variables: SimulatorVariable[];
  output: { label: string; unit: string; decimals: number };
  target: SimulatorTarget;
  tries: number;
  max_tries: number;
  met: boolean;
  last: SimulatorTry | null;
}

export interface QuickCard {
  token: string;
  text: string;
  solved: boolean;
}

export interface QuickView extends ActivityViewBase {
  type: "quick";
  mode: "match" | "order";
  prompt: string;
  seconds: number;
  /** Seconds left; null without a clock. */
  remaining: number | null;
  cards: QuickCard[];
  answers: QuickCard[];
  solved: number;
  total: number;
  streak: number;
  mistakes: number;
  placed: string[];
}

export type ActivityView = DecisionView | InspectionView | SimulatorView | QuickView;

export interface ActivityPlay {
  attempt_id: number;
  activity_id: number;
  view: ActivityView;
  /** Narration key -> audio URL, for the lines this response reveals. */
  narration: Record<string, string>;
  /** A reference photo shown during the play, if the activity has one. */
  image_url: string | null;
  /** The open play, picked up where it was left (a new play otherwise; an admin's preview always starts anew). */
  resumed: boolean;
}

export interface ActivityMoveResult extends PathOutcome {
  result: Record<string, unknown> & { score: number; done: boolean };
  done: boolean;
  narration: Record<string, string>;
  /** What `finish` tells, told by the move that ends the game (null for any other move and in an admin's preview). */
  module_completed: boolean | null;
  next_module_id: number | null;
  course_completed: boolean | null;
}

/** An activity as the admin edits it: its whole spec (answers included). */
export interface ActivityAdmin {
  id: number;
  module_id: number;
  order: number;
  type: ActivityType;
  title: string;
  intro: string;
  spec: Record<string, unknown>;
  version: number;
  status: "draft" | "ready";
  image_asset_id: string | null;
  image_url: string | null;
  voice_status: "none" | "pending" | "ready" | "failed";
  max_score: number;
  /** What keeps it from being published (empty: ready to publish). */
  problems: string[];
  updated_at: string | null;
}

export interface ActivityFinish extends PathOutcome {
  score: number;
  max_score: number;
  module_completed: boolean;
  next_module_id: number | null;
  course_completed: boolean;
}

export interface LearnerCourseDetail {
  course: { id: number; title: string; description: string; language: Language };
  enrollment: { id: number; status: EnrollmentStatus; progress_pct: number; completed_at: string | null } | null;
  modules: LearnerModule[];
  /** Kept closed by a learning path: every module locked, until `locked_by` is completed. */
  locked: boolean;
  locked_by: CourseRef | null;
  path: CoursePath | null;
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
  /** Sent back with the attempt: if the quiz changed meanwhile, the attempt is not graded (409). */
  version: string;
}

export interface QuizAnswer {
  question_id: string;
  response: QuizResponse | null;
}

export type QuizResponse =
  | { option: string }
  | { value: boolean }
  | { order: string[] }
  | { matches: Record<string, string> }
  | { text: string };

export interface AttemptResult extends PathOutcome {
  score: number;
  passed: boolean;
  correct: number;
  total: number;
  attempts_used: number;
  attempts_remaining: number;
  /** `expected` (the solution, in option ids) only comes once the quiz is passed. */
  results: { question_id: string; correct: boolean; explanation: string; expected: unknown }[];
  module_completed: boolean;
  next_module_id: number | null;
  course_completed: boolean;
}

export interface CompletionResult extends PathOutcome {
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
  /** Decks: how many pages the processed PDF has, more than `pages` if some could not be signed (older servers leave it out). */
  page_count?: number | null;
  text_chars: number | null;
  created_at: string | null;
}

/** A slide change in a recording: from `at` seconds into it, the deck page `slide` (from 0) is on screen. */
export interface TimelinePoint {
  at: number;
  slide: number;
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

// AI studio
export type SlideLayout =
  | "cover"
  | "bullets"
  | "statement"
  | "stat"
  | "steps"
  | "comparison"
  | "closing"
  | "chart"
  | "calculation"
  | "case"
  | "visual";
export type SlideTheme = "dark" | "light";

export interface ComparisonColumn {
  heading: string;
  points: string[];
}

export interface Slide {
  layout: SlideLayout;
  eyebrow: string;
  title: string;
  subtitle: string;
  points: string[];
  /** One per point, same order ("" or missing: the layout's plain marker). Names from `slide-icons`. */
  icons?: string[];
  /** The statement's or the figure's icon. */
  icon?: string;
  stat_value: string;
  stat_label: string;
  quote_author: string;
  left: ComparisonColumn;
  right: ComparisonColumn;
  /** "chart": each bar's label and exact value, and their unit. */
  chart_labels?: string[];
  chart_values?: number[];
  chart_unit?: string;
}

export interface SlideContext {
  course_title: string;
  module_label: string;
  index: number;
  total: number;
  theme: SlideTheme;
  presenter: boolean;
  /** The scene has a visual: the preview shows its text over a sample picture. */
  backdrop?: boolean;
}

export type VisualKind = "none" | "stock" | "image" | "clip" | "infographic";

/** What fills the screen behind a scene's text, found or generated when the video is produced. */
export interface SceneVisual {
  kind: VisualKind;
  /** English keywords to search stock video. */
  query: string;
  /** What to generate: an image or a clip (in English), or an infographic (in the course's language). */
  prompt: string;
  /** "Another version" of the same description. */
  variant?: number;
}

export interface StoryboardScene {
  id: string;
  slide: Slide;
  narration: string;
  visual?: SceneVisual;
}

export interface Storyboard {
  scenes: StoryboardScene[];
}

export interface OutlineModule {
  title: string;
  summary: string;
  objectives: string[];
  key_points: string[];
  estimated_minutes: number;
  include_quiz: boolean;
}

export interface CourseOutline {
  title: string;
  description: string;
  audience: string;
  objectives: string[];
  modules: OutlineModule[];
}

export interface OutlineRequest {
  brief: string;
  audience: string;
  tone: string;
  minutes: number;
  modules?: number | null;
  feedback?: string;
}

export interface StudioCapabilities {
  ai: boolean;
  voice: boolean;
  avatar: boolean;
  storage: boolean;
  /** The kinds of scene visual the server can find or generate. */
  visuals?: Exclude<VisualKind, "none">[];
  /** Animated clips per module with the standard animation. */
  max_clips?: number;
}

export interface Voice {
  id: string;
  name: string;
  gender: string;
  accent: string;
  language: string;
  preview_url: string;
  category: string;
}

export interface Avatar {
  id: string;
  name: string;
  preview_image_url: string;
  preview_video_url: string;
  gender: string;
  /** The company's own avatar (made from a photo of one of its people): listed first. */
  own?: boolean;
  /** HeyGen engines it renders on (empty: any). */
  engines?: string[];
}

export interface RenderRequest {
  module_ids?: number[];
  voice_id?: string;
  voice_name?: string;
  avatar_id?: string;
  avatar_name?: string;
  co_avatar_id?: string;
  co_avatar_name?: string;
  co_voice_id?: string;
  co_voice_name?: string;
  avatar_engine?: AvatarEngine;
  animation?: Animation;
  presenter?: boolean;
  theme?: SlideTheme;
}
