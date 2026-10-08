"use client";

import { Suspense, useCallback, useRef, useState } from "react";
import Link from "next/link";
import { notFound, useParams, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Lock } from "lucide-react";
import { BackLink } from "@/components/layout/back-link";
import { EmptyState } from "@/components/layout/empty-state";
import { PageError, PageLoading } from "@/components/layout/query-state";
import { SplashScreen } from "@/components/layout/splash-screen";
import { ActivityPlayer } from "@/components/learn/activities/activity-player";
import { CourseCompleteDialog } from "@/components/learn/course-complete-dialog";
import { pathPlace } from "@/components/learn/learner-course-card";
import { ModuleNav } from "@/components/learn/module-nav";
import { ModuleView } from "@/components/learn/module-view";
import { QuizDialog } from "@/components/learn/quiz/quiz-dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ApiError } from "@/lib/api/client";
import { learnApi, learnKeys } from "@/lib/api/learn";
import type {
  ActivityFinish,
  CompletionResult,
  LearnerActivitySummary,
  LearnerCourseDetail,
  PathOutcome,
} from "@/lib/api/types";
import { formatPercent, plural } from "@/lib/format";
import { useUnmountSignal } from "@/lib/hooks/use-unmount-signal";
import { toastError } from "@/lib/notify";

const NO_OUTCOME: PathOutcome = { next_course: null, path_completed: null };

/** A course the learner can't open (not assigned, removed or locked): what happened, and the way back. */
function CourseUnavailable({ message }: { message: string }) {
  return (
    <div className="container py-12">
      <EmptyState
        icon={<Lock />}
        title="No puedes abrir este curso"
        description={`${message.replace(/[.\s]*$/, ".")} Si crees que es un error, habla con tu administrador.`}
        action={
          <Button variant="outline" asChild>
            <Link href="/learn">
              <ArrowLeft /> Volver a mis cursos
            </Link>
          </Button>
        }
      />
    </div>
  );
}

/** The course's band: the way back, its place in the learner's path and its title (and, open, the progress). */
function CourseBand({ detail, children }: { detail: LearnerCourseDetail; children?: React.ReactNode }) {
  const place = pathPlace(detail);
  return (
    <section className="band-dark">
      <div className="container relative z-10 py-8">
        <BackLink href="/learn">Mis cursos</BackLink>
        <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            {place && <p className="eyebrow mb-3 text-white/60">{place}</p>}
            <h1 className="display-lg text-balance text-white">{detail.course.title}</h1>
          </div>
          {children}
        </div>
      </div>
    </section>
  );
}

/** Opened by its address while its path keeps it closed: what opens it, and the way there. */
function CourseLocked({ detail }: { detail: LearnerCourseDetail }) {
  const by = detail.locked_by;
  return (
    <>
      <CourseBand detail={detail} />
      <div className="container py-10">
        <div className="flex flex-col items-center gap-4 border border-border bg-white px-6 py-16 text-center">
          <Lock className="h-8 w-8 text-muted-foreground" aria-hidden />
          <h2 className="display-md">Este curso aún está bloqueado</h2>
          <p className="max-w-md text-muted-foreground">
            {by
              ? `Se desbloquea al terminar «${by.title}», el curso anterior de tu ruta.`
              : "Se desbloquea al terminar el curso anterior de tu ruta."}
          </p>
          <div className="mt-2 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
            {by && (
              <Button variant="accent" className="h-auto min-h-11 w-full max-w-full whitespace-normal py-3 sm:w-auto" asChild>
                <Link href={`/learn/${by.course_id}`}>
                  Ir a «{by.title}» <ArrowRight />
                </Link>
              </Button>
            )}
            <Button variant="outline" className="w-full sm:w-auto" asChild>
              <Link href="/learn">
                <ArrowLeft /> Volver a mis cursos
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

function CoursePlayer() {
  const params = useParams<{ courseId: string }>();
  const courseId = Number(params.courseId);
  const validId = Number.isInteger(courseId) && courseId > 0;
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const content = useRef<HTMLDivElement>(null);
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizSession, setQuizSession] = useState(0);
  // The quiz belongs to the module it was opened from, even when passing it moves `current` along.
  const [quizModuleId, setQuizModuleId] = useState<number | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  // What the completion opened in the learner's paths: kept after closing, so the dialog doesn't change as it fades.
  const [outcome, setOutcome] = useState<PathOutcome>(NO_OUTCOME);
  // The activity being played, and whether its module was already completed when it opened (playing again for
  // a better score must not move the learner on, nor celebrate the course again).
  const [playing, setPlaying] = useState<{ activity: LearnerActivitySummary; session: number; wasCompleted: boolean } | null>(
    null,
  );
  // The last play's result: when it completed the module, closing the activity moves on.
  const finishedPlay = useRef<ActivityFinish | null>(null);
  // Whether an activity is on screen: a play recorded once its player closed moves on by itself.
  const playerOpen = useRef(false);
  const unmounted = useUnmountSignal();

  const detail = useQuery({ queryKey: learnKeys.course(courseId), queryFn: () => learnApi.course(courseId), enabled: validId });
  const modules = detail.data?.modules ?? [];
  const requested = Number(searchParams.get("m"));
  // The module in the URL if it's open; otherwise the first one still to do.
  const current =
    modules.find((module) => module.id === requested && module.unlocked) ??
    modules.find((module) => module.unlocked && !module.completed) ??
    modules[0];
  const nextModule = current ? modules[modules.indexOf(current) + 1] ?? null : null;
  const quizModule = modules.find((module) => module.id === quizModuleId);

  // Set when the learner moves to another module: its title takes the focus once it shows.
  const focusNextTitle = useRef(false);
  const focusTitle = useCallback((node: HTMLHeadingElement | null) => {
    if (node && focusNextTitle.current) {
      focusNextTitle.current = false;
      node.focus({ preventScroll: true });
    }
  }, []);

  const show = (moduleId: number) => {
    focusNextTitle.current = true;
    router.replace(`/learn/${courseId}?m=${moduleId}`, { scroll: false });
    content.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const refreshCourse = () => queryClient.invalidateQueries({ queryKey: learnKeys.course(courseId) });

  /** After a module is done: refresh the course (unlocks the next), then go on or celebrate. */
  const advance = async (result: Pick<CompletionResult, "course_completed" | "next_module_id"> & PathOutcome) => {
    await refreshCourse();
    void queryClient.invalidateQueries({ queryKey: learnKeys.courses });
    void queryClient.invalidateQueries({ queryKey: learnKeys.paths });
    // A completed course may open the next one of its path: other courses seen before load afresh (never shown locked
    // for a moment from the cache).
    if (result.course_completed) {
      queryClient.removeQueries({ queryKey: learnKeys.courseDetails, predicate: (query) => query.queryKey[2] !== courseId });
    }
    // Done after the learner left the course (a play recorded late, a slow answer): it never brings them back.
    if (unmounted().aborted) return;
    if (result.course_completed) {
      setOutcome({ next_course: result.next_course, path_completed: result.path_completed });
      setCelebrating(true);
    } else if (result.next_module_id) show(result.next_module_id);
  };

  const complete = useMutation({
    mutationFn: (moduleId: number) => learnApi.complete(moduleId),
    onSuccess: advance,
    onError: (error) => {
      toastError(error);
      // e.g. the admin added a quiz meanwhile, or another device completed it: show the course as it is now.
      void refreshCourse();
    },
  });

  if (!validId) notFound();
  if (detail.isPending) return <PageLoading bodyClassName="aspect-video" />;
  if (!detail.data) {
    const { error } = detail;
    // Not theirs, removed or locked: retrying won't help, the way back does.
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
      return <CourseUnavailable message={error.message} />;
    }
    return <PageError query={detail} />;
  }

  // Its path keeps it closed until the course before it is completed: nothing to study yet.
  if (detail.data.locked) return <CourseLocked detail={detail.data} />;

  const { course, enrollment } = detail.data;
  const completedCount = modules.filter((module) => module.completed).length;
  const progress = enrollment?.progress_pct ?? 0;

  return (
    <>
      <CourseBand detail={detail.data}>
        <div className="w-full max-w-xs">
          <div className="mb-2 flex justify-between text-sm text-white/70">
            <span>
              {completedCount} de {plural(modules.length, "módulo")}
            </span>
            <span className="font-semibold text-white">{formatPercent(progress)}</span>
          </div>
          <Progress value={progress} className="bg-white/15" />
        </div>
      </CourseBand>

      <div ref={content} className="container grid scroll-mt-20 grid-cols-1 gap-10 py-10 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          {current && <ModuleNav modules={modules} currentId={current.id} onSelect={(module) => show(module.id)} />}
        </aside>
        <AnimatePresence mode="wait">
          {current && (
            <motion.div key={current.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <ModuleView
                module={current}
                headingRef={focusTitle}
                language={course.language}
                nextModule={nextModule}
                completing={complete.isPending}
                onComplete={() => complete.mutate(current.id)}
                onOpenQuiz={() => {
                  setQuizModuleId(current.id);
                  setQuizSession((session) => session + 1);
                  setQuizOpen(true);
                }}
                onNext={() => nextModule && show(nextModule.id)}
                onPlayActivity={(activity) => {
                  finishedPlay.current = null;
                  playerOpen.current = true;
                  setPlaying((last) => ({ activity, session: (last?.session ?? 0) + 1, wasCompleted: current.completed }));
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {playing && (
        <ActivityPlayer
          key={playing.session}
          activity={playing.activity}
          language={course.language}
          open
          api={{
            start: (untimed) => learnApi.startActivity(playing.activity.id, untimed),
            move: learnApi.move,
            finish: learnApi.finishActivity,
          }}
          onFinished={(result) => {
            void refreshCourse();
            // Playing again for a better score moves nothing on; the play that completed the module does: as the
            // activity on screen closes (this one, or another opened meanwhile), or right away if none is open.
            if (playing.wasCompleted || !result.module_completed) return;
            if (playerOpen.current) finishedPlay.current = result;
            else void advance(result);
          }}
          // Its save as it closed failed: the module shows what the server kept (the last move counted the play).
          onRecordFailed={() => void refreshCourse()}
          onOpenChange={(open) => {
            if (open) return;
            playerOpen.current = false;
            setPlaying(null);
            const result = finishedPlay.current;
            finishedPlay.current = null;
            if (result) void advance(result);
            // A play left open is resumed from its card ("Continuar"); one that ended shows once it is recorded.
            else void refreshCourse();
          }}
        />
      )}
      {quizModule?.quiz && (
        <QuizDialog
          key={`${quizModule.id}:${quizSession}`} // a new module or a new opening starts clean, never on a past result
          courseId={courseId}
          module={quizModule}
          session={quizSession}
          open={quizOpen}
          onOpenChange={setQuizOpen}
          onPassed={(result) => {
            setQuizOpen(false);
            void advance(result);
          }}
        />
      )}
      <CourseCompleteDialog open={celebrating} courseTitle={course.title} outcome={outcome} onOpenChange={setCelebrating} />
    </>
  );
}

export default function CoursePlayerPage() {
  return (
    <Suspense fallback={<SplashScreen />}>
      <CoursePlayer />
    </Suspense>
  );
}
