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
  /** A certificate on completion: true or false whatever the platform's parameter, null follows it. */
  certificate?: boolean | null;
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
  /** Earned by completing it (valid or expired; null once revoked). */
  certificate: CertificateRef | null;
}

// Certificates: earned by completing a course or a path; anyone with the code can verify them.
export type CertificateKind = "course" | "path";
export type CertificateStatus = "valid" | "expired" | "revoked";

/** A learner's certificate, as the course and path views link it. */
export interface CertificateRef {
  id: number;
  /** "RC-XXXX-XXXX". */
  code: string;
  /** Absolute: the PDF opens without a session. */
  pdf_url: string;
  /** The app's public verification page. */
  verify_url: string;
}

export interface LearnerCertificate {
  id: number;
  code: string;
  kind: CertificateKind;
  title: string;
  issued_at: string;
  expires_at: string | null;
  status: CertificateStatus;
  /** Null once the course (or path) is deleted: the certificate stays. */
  course_id: number | null;
  path_id: number | null;
  /** Average best quiz score (null: no quiz taken). */
  score: number | null;
  /** A revoked one keeps it, but the PDF is no longer served (410). */
  pdf_url: string;
  verify_url: string;
}

export interface AdminCertificate extends LearnerCertificate {
  recipient_name: string;
  user_id: number;
  revoked_at: string | null;
  revoked_reason: string | null;
}

export interface AdminCertificatePage {
  items: AdminCertificate[];
  total: number;
}

/** The snapshot taken when it was issued: later edits never change it. */
export interface CertificateDetails {
  /** Of the course's (or path's) videos. */
  hours: number;
  modules: number;
  /** The course, or the path's published courses in order. */
  courses: { title: string; completed_at: string | null }[];
  average_score: number | null;
  company_name: string;
  signer_name: string;
  signer_title: string;
  /** Where its dates are written (null: the platform's current one). */
  timezone: string | null;
}

/** What anyone with the code sees, signed in or not. */
export interface PublicCertificate {
  code: string;
  status: CertificateStatus;
  kind: CertificateKind;
  recipient_name: string;
  title: string;
  issued_at: string;
  expires_at: string | null;
  /** The company's name, or "Rubinstein Colleague". */
  issuer_name: string;
  details: CertificateDetails;
  pdf_url: string;
}

export interface CompletedPath extends PathRef {
  /** The path's certificate, when it gives one. */
  certificate: CertificateRef | null;
}

/** What completing a course earned and opened in the learner's paths (all null until the course is completed). */
export interface PathOutcome {
  /** The course's certificate (issued now or before; null when it gives none). */
  certificate: CertificateRef | null;
  /** The next course of its path, now available. */
  next_course: CourseRef | null;
  /** The path this course completed. */
  path_completed: CompletedPath | null;
}

// The platform's parameters ("Parámetros"): every key has a default.
export interface GeneralSettings {
  /** The issuer of the certificates ("" = Rubinstein Colleague). */
  company_name: string;
  /** An IANA zone, spelled exactly ("America/Bogota"): where dates are written. */
  timezone: string;
}

/** What a new evaluation starts with (by hand or drafted by the AI). */
export interface EvaluationDefaults {
  passing_score: number;
  max_attempts: number;
}

export interface CertificateSettings {
  /** Issued by themselves on completion (a course can opt in or out). */
  enabled: boolean;
  /** Null: they never expire. */
  validity_months: number | null;
  /** Average best quiz score a course certificate needs (null: any). */
  min_score: number | null;
  signer_name: string;
  signer_title: string;
}

/** Who sees the ranking, and the points each completion earns (0-1000; earned once, never paid again). */
export interface RankingSettings {
  /** Collaborators see it (admins always do). */
  visible_to_learners: boolean;
  /** Else learners read "Ana P.": the first name and the initial of the next one. */
  show_full_names: boolean;
  points_module: number;
  points_course: number;
  points_path: number;
}

export interface PlatformSettings {
  general: GeneralSettings;
  evaluations: EvaluationDefaults;
  certificates: CertificateSettings;
  ranking: RankingSettings;
}

/** The parameters a learner's app needs. */
export interface LearnerSettings {
  ranking_visible: boolean;
  company_name: string;
}

// Ranking: who earned the most points in a period, over every course or in a path. Points come from improving one's
// best in activities and quizzes (up to 100 each) and from completing modules, courses and paths.
/** Today, this week (from Monday), this month or since ever, in the platform's time zone. */
export type RankingPeriod = "today" | "week" | "month" | "all";

export interface RankingItem {
  /** Ties share it (1, 2, 2, 4). */
  rank: number;
  user: { id: number; name: string; profile: ProfileRef | null };
  points: number;
  /** Completed for the first time in the period (and the path's courses, with a path). */
  completed_courses: number;
}

/** The admin's: active collaborators who earned points in the period, best first. */
export interface Ranking {
  period: RankingPeriod;
  /** When the period began, with the platform's offset (null for "all"). */
  starts_at: string | null;
  path: PathRef | null;
  items: RankingItem[];
  /** Everyone ranked, beyond the items listed. */
  total_people: number;
}

export interface LearnerRankingItem {
  rank: number;
  /** Full, or "Ana P." when the parameters hide full names. */
  name: string;
  initials: string;
  points: number;
  is_me: boolean;
}

/** A learner's: the top 10 and their own place. Hidden by the parameters: `visible` false and nothing else. */
export interface LearnerRanking {
  visible: boolean;
  period: RankingPeriod;
  starts_at: string | null;
  path: PathRef | null;
  items: LearnerRankingItem[];
  /** Null until they earn points in the period (and the path). */
  me: { rank: number; points: number } | null;
  total_people: number;
}

// A person's overview for admins ("ficha"): who they are, their numbers, paths, courses module by module,
// certificates and the latest things they did.
export interface PersonUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  position: string;
  department: string;
  profile: ProfileRef | null;
  is_active: boolean;
  created_at: string | null;
  /** Their last sign-in or session refresh (null: never signed in). */
  last_seen_at: string | null;
}

export interface PersonKpis {
  courses_assigned: number;
  courses_completed: number;
  /** Mean of their best quiz scores (null: no quiz taken). */
  average_score: number | null;
  /** Ever earned. */
  points: number;
  /** Valid ones. */
  certificates: number;
  /** Different activities played to the end. */
  activities_played: number;
}

/** One of their published paths, as they see it, and how they got it. */
export interface PersonPath extends LearnerPath {
  source: AssignmentSource;
}

export interface PersonActivity {
  activity_id: number;
  title: string;
  type: ActivityType;
  /** Of their finished plays (null: none yet). */
  best_score: number | null;
  max_score: number;
  /** Finished plays. */
  plays: number;
  last_played_at: string | null;
}

export interface PersonModule {
  module_id: number;
  title: string;
  order: number;
  completed: boolean;
  completed_at: string | null;
  /** Null when the module has no quiz. */
  quiz: QuizSummary | null;
  /** The module's published activities, in order. */
  activities: PersonActivity[];
}

export interface PersonCourse {
  course_id: number;
  title: string;
  /** Of their enrollment. */
  status: EnrollmentStatus;
  /** Of the course (learners only see published ones). */
  course_status: CourseStatus;
  progress_pct: number;
  enrolled_at: string | null;
  completed_at: string | null;
  /** Kept closed by one of their learning paths. */
  locked: boolean;
  /** The one not revoked. */
  certificate: CertificateRef | null;
  modules: PersonModule[];
}

export type RecentKind =
  | "quiz_passed"
  | "quiz_failed"
  | "activity_finished"
  | "module_completed"
  | "course_completed"
  | "certificate_issued"
  | "path_completed";

export interface RecentEvent {
  kind: RecentKind;
  at: string;
  /** The module, activity, course, certificate or path. */
  title: string;
  /** The course it was in, the certificate's code, or "". */
  detail: string;
  /** 0-100: a quiz's score, a play's share of its maximum, a certificate's average. */
  score: number | null;
}

export interface PersonOverview {
  user: PersonUser;
  kpis: PersonKpis;
  /** Published, oldest assignment first (as they see them). */
  paths: PersonPath[];
  /** Newest enrollment first, drafts included. */
  courses: PersonCourse[];
  /** Newest first, revoked included. */
  certificates: AdminCertificate[];
  /** The latest 25, newest first. */
  recent: RecentEvent[];
}

/** A person's attempts at a module's quiz, given back by an admin (their answers stay in the history). */
export interface QuizReset {
  attempts_used: number;
  max_attempts: number;
}

export type DashboardActivityKind = "passed_quiz" | "failed_quiz" | "completed_course" | "certificate_issued" | "path_completed";

export interface DashboardActivity {
  kind: DashboardActivityKind;
  user_id: number;
  user_name: string;
  /** A course's (a course certificate's too). Null for a path's, or once the course is gone. */
  course_id: number | null;
  /** The course's, or the course certificate's title ("" for a path's). */
  course_title: string;
  module_title: string | null;
  /** A path completed, or a path's certificate (null once that path is gone). */
  path_id: number | null;
  path_title: string | null;
  certificate_code: string | null;
  score: number | null;
  at: string | null;
}

export interface Dashboard {
  courses: { total: number; published: number; draft: number; generating: number };
  /** Active: took a quiz, completed a module or played an activity in the last 30 days. */
  learners: { total: number; active_30d: number };
  enrollments: { total: number; completed: number; in_progress: number };
  completion_rate: number;
  average_score: number | null;
  recent_activity: DashboardActivity[];
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
  /** Earned by completing it (valid or expired; null once revoked). */
  certificate: CertificateRef | null;
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
  certificate: CertificateRef | null;
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

/** What a layout warning is about. */
export type LayoutWarningCode =
  | "text_truncated" // a text doesn't fit even at its smallest size: its end is cut
  | "word_broken" // a word wider than its box is split across lines
  | "presenter_overlap" // under the presenter (its bubble, or large on the cover and the closing)
  | "motif_overlap" // over the brand motif in the corner
  | "frame_overlap" // over the slide's header or its counter
  | "outside_safe_area" // past the slide's margins
  | "text_overlap" // two texts on top of each other
  | "visual_under_presenter"; // the presenter's bubble covers drawings of the scene's infographic

/** Something on a scene's slide that doesn't fit or overlaps, found by drawing it as the video draws it. */
export interface LayoutWarning {
  scene_id: string;
  code: LayoutWarningCode;
  /** "warning": a broken word or an infographic under the presenter; anything else is an "error". */
  severity: "error" | "warning";
  /**
   * The slide's field the admin edits: "title", "subtitle", "stat_value", "stat_label", "quote_author", "icon",
   * "points.2" (its index in `points`, blank ones included), "left.heading", "right.points.0", "chart_labels.1",
   * "chart_values.1" (the bar and its value), "visual" (the infographic); null for a decoration of the layout.
   */
  field: string | null;
  /** For the admin, in Spanish. */
  message: string;
}

/** The saved script, with what doesn't fit or overlaps on its slides (older servers leave the warnings out). */
export interface StoryboardOut extends Storyboard {
  warnings?: LayoutWarning[];
}

/** A script being edited, as its slides are checked (not saved): a narration may be empty or left out. */
export interface StoryboardDraft {
  scenes: (Omit<StoryboardScene, "narration"> & { narration?: string })[];
}

/** What doesn't fit or overlaps on the slides of a script being edited (it is checked, never saved). */
export interface StoryboardLint {
  warnings: LayoutWarning[];
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
