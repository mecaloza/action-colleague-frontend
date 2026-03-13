"use client";

import { motion } from "framer-motion";
import { Trash2, Sparkles, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Communication } from "@/lib/types";
import { useTranslations } from "next-intl";

interface CommunicationCardProps {
  communication: Communication;
  onDelete: (id: number) => void;
  index: number;
}

export function CommunicationCard({ communication, onDelete, index }: CommunicationCardProps) {
  const t = useTranslations("adminCommunications");
  const date = new Date(communication.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm transition-all duration-300 hover:border-violet-500/20 hover:bg-white/[0.05] hover:shadow-lg hover:shadow-violet-500/5"
    >
      {communication.image_url && (
        <div className="relative h-48 overflow-hidden">
          <img
            src={communication.image_url}
            alt={communication.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f1a] via-transparent to-transparent" />
        </div>
      )}

      <div className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold text-white line-clamp-2">
            {communication.title}
          </h3>
          {communication.ai_generated && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-violet-500/15 px-2.5 py-1 text-xs font-medium text-violet-400 border border-violet-500/20">
              <Sparkles className="h-3 w-3" />
              AI
            </span>
          )}
        </div>

        <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
          {communication.message}
        </p>

        <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            {date}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground opacity-0 transition-all duration-200 hover:text-red-400 hover:bg-red-500/10 group-hover:opacity-100"
            onClick={() => onDelete(communication.id)}
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">{t("delete")}</span>
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
