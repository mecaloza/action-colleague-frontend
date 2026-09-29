"use client";

import { Suspense, useCallback, useRef, useState } from "react";
import { notFound, useParams, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { BackLink } from "@/components/layout/back-link";
import { PageError, PageLoading } from "@/components/layout/query-state";
import { SplashScreen } from "@/components/layout/splash-screen";
import { CourseCompleteDialog } from "@/components/learn/course-complete-dialog";
import { ModuleNav } from "@/components/learn/module-nav";
import { ModuleView } from "@/components/learn/module-view";
import { QuizDialog } from "@/components/learn/quiz/quiz-dialog";
import { Progress } from "@/components/ui/progress";
import { learnApi, learnKeys } from "@/lib/api/learn";
import type { CompletionResult } from "@/lib/api/types";
import { formatPercent, plural } from "@/lib/format";
import { toastError } from "@/lib/notify";

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

  /** After a module is done: refresh the course (unlocks the next), then go on or celebrate. */
  const advance = async (outcome: Pick<CompletionResult, "course_completed" | "next_module_id">) => {
    await queryClient.invalidateQueries({ queryKey: learnKeys.course(courseId) });
    void queryClient.invalidateQueries({ queryKey: learnKeys.courses });
    if (outcome.course_completed) setCelebrating(true);
    else if (outcome.next_module_id) show(outcome.next_module_id);
  };

  const complete = useMutation({
    mutationFn: (moduleId: number) => learnApi.complete(moduleId),
    onSuccess: advance,
    onError: (error) => {
      toastError(error);
      // e.g. the admin added a quiz meanwhile, or another device completed it: show the course as it is now.
      void queryClient.invalidateQueries({ queryKey: learnKeys.course(courseId) });
    },
  });

  if (!validId) notFound();
  if (detail.isPending) return <PageLoading bodyClassName="aspect-video" />;
  if (!detail.data) return <PageError query={detail} />;

  const { course, enrollment } = detail.data;
  const completedCount = modules.filter((module) => module.completed).length;
  const progress = enrollment?.progress_pct ?? 0;

  return (
    <>
      <section className="band-dark">
        <div className="container relative z-10 py-8">
          <BackLink href="/learn">Mis cursos</BackLink>
          <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <h1 className="display-lg max-w-3xl text-balance text-white">{course.title}</h1>
            <div className="w-full max-w-xs">
              <div className="mb-2 flex justify-between text-sm text-white/70">
                <span>
                  {completedCount} de {plural(modules.length, "módulo")}
                </span>
                <span className="font-semibold text-white">{formatPercent(progress)}</span>
              </div>
              <Progress value={progress} className="bg-white/15" />
            </div>
          </div>
        </div>
      </section>

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
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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
      <CourseCompleteDialog open={celebrating} courseTitle={course.title} onOpenChange={setCelebrating} />
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
