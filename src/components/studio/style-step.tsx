"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clapperboard, Mic } from "lucide-react";
import { useConfirm } from "@/components/layout/confirm-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { studioApi } from "@/lib/api/studio";
import type { CourseDetail, Job, Slide, SlideTheme, StudioCapabilities } from "@/lib/api/types";
import { plural } from "@/lib/format";
import { useCourseCache } from "@/lib/hooks/use-course-cache";
import { ChoiceButton } from "./choice-button";
import { PresenterPicker } from "./presenter-picker";
import { SlidePreview } from "./slide-preview";
import { aiModules, moduleActivity, videoStyle } from "./steps";
import { useStudioCache } from "./use-studio-cache";
import { VoicePicker } from "./voice-picker";

const THEMES: { value: SlideTheme; label: string }[] = [
  { value: "dark", label: "Oscuro" },
  { value: "light", label: "Claro" },
];

/** A cover with only a title and a caption: the server renders it as it will render the video slides. */
const SAMPLE_SLIDE: Slide = {
  layout: "cover",
  eyebrow: "",
  title: "",
  subtitle: "Así se verán tus videos",
  points: [],
  stat_value: "",
  stat_label: "",
  quote_author: "",
  left: { heading: "", points: [] },
  right: { heading: "", points: [] },
};

/** A voice or presenter picked here: its id goes to the render and its name is stored with the course. */
interface Picked {
  id: string;
  name: string;
}

/** What the course already has saved, if anything. */
const savedPick = (id: string, name: string): Picked | null => (id ? { id, name } : null);

function SectionTitle({ number, title, hint }: { number: string; title: string; hint: string }) {
  return (
    <div className="mb-5">
      <p className="eyebrow mb-2">{number}</p>
      <h3 className="font-display text-2xl font-medium tracking-tightest">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

interface StyleStepProps {
  course: CourseDetail;
  /** The course's active jobs: nothing is produced while the AI is writing a script. */
  jobs: Job[];
  capabilities: StudioCapabilities;
  onProducing: () => void;
}

/** Voice, presenter and look of the course's videos; then produce them. */
export function StyleStep({ course, jobs, capabilities, onProducing }: StyleStepProps) {
  const confirm = useConfirm();
  const { refreshCourse } = useCourseCache();
  const { trackJobs, failed } = useStudioCache();
  const settings = course.settings;
  const saved = videoStyle(settings);
  const [voice, setVoice] = useState(savedPick(settings.voice_id, settings.voice_name));
  const [wantsPresenter, setWantsPresenter] = useState(saved.presenter);
  // Derived, not stored: the capabilities may arrive after this step first renders.
  const presenter = capabilities.avatar && wantsPresenter;
  const [avatar, setAvatar] = useState(savedPick(settings.avatar_id, settings.avatar_name));
  const [theme, setTheme] = useState(saved.theme);
  const modules = aiModules(course);
  // What gets produced: every AI module with a script (the API skips the others).
  const videoCount = modules.filter((module) => module.scene_count > 0).length;
  // The API refuses to produce a module while its script is being written.
  const drafting = modules.some((module) => moduleActivity(module, jobs) === "drafting");
  const rendering = modules.some((module) => moduleActivity(module, jobs) === "rendering");
  const sample = modules[0];

  const produce = useMutation({
    mutationFn: () =>
      studioApi.render(course.id, {
        voice_id: voice?.id,
        voice_name: voice?.name,
        presenter,
        avatar_id: presenter ? avatar?.id : undefined,
        avatar_name: presenter ? avatar?.name : undefined,
        theme,
      }),
    onSuccess: (queued) => {
      trackJobs(course.id, queued);
      void refreshCourse(course.id);
      toast.success("Producción iniciada. Te avisamos aquí a medida que cada video esté listo.");
      onProducing();
    },
    onError: failed(course.id),
  });

  // Producing again replaces videos the people taking a published course see: ask first.
  const start = async () => {
    const replaces = modules.some((module) => module.scene_count > 0 && module.video);
    if (course.status === "published" && replaces) {
      const confirmed = await confirm({
        title: "¿Volver a producir los videos?",
        description: "El curso está publicado: quienes lo toman verán los videos nuevos a medida que estén listos.",
        confirmLabel: "Producir",
      });
      if (!confirmed) return;
    }
    produce.mutate();
  };

  if (!capabilities.voice) {
    return (
      <Alert variant="warning">
        <Mic />
        <div>
          <AlertTitle>La narración no está configurada</AlertTitle>
          <AlertDescription>
            Falta la llave de ElevenLabs en el servidor para producir los videos con voz.
          </AlertDescription>
        </div>
      </Alert>
    );
  }

  const summary = [
    voice ? `Voz: ${voice.name}` : "Elige una voz",
    presenter ? (avatar ? `Presentador: ${avatar.name}` : "Elige un presentador") : "Sin presentador",
  ].join(" · ");

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
      <div className="space-y-12">
        <section>
          <h2 tabIndex={-1} className="sr-only">
            Estilo y voz de los videos
          </h2>
          <SectionTitle number="01" title="Voz" hint="Quién narra el curso. Escucha las muestras antes de elegir." />
          <VoicePicker language={course.language} selectedId={voice?.id} onSelect={setVoice} />
        </section>

        <section>
          <SectionTitle
            number="02"
            title="Presentador"
            hint="Una persona virtual que narra en una burbuja, sin tapar las diapositivas."
          />
          <PresenterPicker
            available={capabilities.avatar}
            presenter={presenter}
            onPresenterChange={setWantsPresenter}
            selectedId={avatar?.id}
            onSelect={setAvatar}
          />
        </section>

        <section>
          <SectionTitle number="03" title="Diseño" hint="Colores de las diapositivas, con tu marca." />
          <div className="flex gap-2">
            {THEMES.map(({ value, label }) => (
              <ChoiceButton
                key={value}
                selected={theme === value}
                onClick={() => setTheme(value)}
                className="h-10 px-5 text-[12px] font-bold uppercase tracking-label"
              >
                {label}
              </ChoiceButton>
            ))}
          </div>
        </section>
      </div>

      <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
        <SlidePreview
          slide={{ ...SAMPLE_SLIDE, title: course.title }}
          context={{
            course_title: course.title,
            // The first slide of the first module: the counter shows its slides, not how many videos there are.
            module_label: `Módulo ${sample?.order ?? 1}`,
            index: 1,
            total: Math.max(1, sample?.scene_count ?? 0),
            theme,
            presenter,
          }}
          alt="Vista previa del diseño"
        />
        <div className="border border-border bg-white p-6">
          <p className="text-sm text-muted-foreground">{summary}</p>
          <Button
            variant="accent"
            className="mt-5 w-full"
            onClick={start}
            loading={produce.isPending}
            disabled={!voice || (presenter && !avatar) || drafting || rendering || !videoCount}
          >
            <Clapperboard /> Producir {plural(videoCount, "video")}
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">
            {drafting
              ? "La IA está escribiendo algún guion: podrás producir los videos cuando termine."
              : rendering
                ? "Hay videos produciéndose: podrás producir de nuevo cuando terminen."
              : videoCount
                ? "Cada video tarda unos minutos. Puedes cerrar esta página."
                : "Ningún módulo tiene guion todavía: escríbelos en el paso Contenido."}
          </p>
        </div>
      </aside>
    </div>
  );
}
