"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, FileVideo, Sparkles } from "lucide-react";
import { PageHero } from "@/components/layout/page-hero";

const OPTIONS = [
  {
    number: "01",
    href: "/admin/courses/create",
    icon: Sparkles,
    title: "Crear con IA",
    description:
      "Describe el curso y sube tus documentos (PDF, Word, PowerPoint). La IA propone la estructura, escribe los guiones y la evaluación, y produce videos con tu marca, voz y presentador.",
    points: ["Estructura y guiones en minutos", "Slides legibles con tu marca", "Voz natural, subtítulos y presentador"],
  },
  {
    number: "02",
    href: "/admin/courses/new/manual",
    icon: FileVideo,
    title: "Con mi material",
    description:
      "¿Ya tienes el contenido? Sube tus videos o documentos, o grábate con tus diapositivas desde el navegador. Agrega evaluaciones a mano o con ayuda de la IA.",
    points: ["Sube videos de cualquier formato", "Graba cámara + presentación PDF", "Evaluaciones manuales o con IA"],
  },
];

export default function NewCoursePage() {
  return (
    <>
      <PageHero eyebrow="Nuevo curso" title="¿Cómo quieres crearlo?" description="Puedes combinar ambos caminos después: todo curso se edita módulo por módulo." />
      <section className="container grid gap-6 py-12 md:grid-cols-2">
        {OPTIONS.map((option, index) => (
          <motion.div
            key={option.href}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * index, duration: 0.4 }}
          >
            <Link
              href={option.href}
              className="group flex h-full flex-col border border-border bg-white p-8 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-1 hover:border-ink-800 hover:shadow-[0_24px_60px_-30px_rgba(0,0,0,0.5)] md:p-10"
            >
              <div className="flex items-start justify-between">
                <span className="font-display text-6xl font-medium leading-none tracking-tightest text-fog transition-colors group-hover:text-accent">
                  {option.number}
                </span>
                <option.icon className="h-7 w-7 text-accent" />
              </div>
              <h2 className="mt-10 font-display text-4xl font-medium tracking-tightest">{option.title}</h2>
              <p className="mt-4 text-muted-foreground">{option.description}</p>
              <ul className="mt-6 space-y-2.5">
                {option.points.map((point) => (
                  <li key={point} className="flex items-start gap-3 text-sm">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rotate-45 bg-accent" />
                    {point}
                  </li>
                ))}
              </ul>
              <span className="mt-10 inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-label text-ink-800 group-hover:text-accent">
                Empezar <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          </motion.div>
        ))}
      </section>
    </>
  );
}
