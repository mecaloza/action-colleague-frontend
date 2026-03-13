"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Sparkles, Loader2, ImageIcon } from "lucide-react";
import { api } from "@/lib/api";
import { useTranslations } from "next-intl";

interface CreateCommunicationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

type ImageMode = "upload" | "generate";

export function CreateCommunicationModal({
  open,
  onOpenChange,
  onCreated,
}: CreateCommunicationModalProps) {
  const t = useTranslations("adminCommunications.modal");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [imageMode, setImageMode] = useState<ImageMode>("upload");
  const [imageUrl, setImageUrl] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [generatedImageUrl, setGeneratedImageUrl] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const resetForm = () => {
    setTitle("");
    setMessage("");
    setImageUrl("");
    setAiPrompt("");
    setGeneratedImageUrl("");
    setImageMode("upload");
  };

  const handleGenerateImage = async () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    try {
      const res = await api.generateCommunicationImage(aiPrompt);
      setGeneratedImageUrl(res.image_url);
    } catch {
      // error handled silently
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!title.trim() || !message.trim()) return;
    setIsPublishing(true);
    try {
      const finalImageUrl = imageMode === "generate" ? generatedImageUrl : imageUrl;
      await api.createCommunication({
        title,
        message,
        image_url: finalImageUrl || undefined,
        ai_generated: imageMode === "generate" && !!generatedImageUrl,
      });
      resetForm();
      onOpenChange(false);
      onCreated();
    } catch {
      // error handled silently
    } finally {
      setIsPublishing(false);
    }
  };

  const previewUrl = imageMode === "generate" ? generatedImageUrl : imageUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogClose onClose={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label>{t("commTitle")}</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("titlePlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("message")}</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("messagePlaceholder")}
              rows={4}
            />
          </div>

          {/* Image mode toggle */}
          <div className="space-y-3">
            <Label>{t("image")}</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setImageMode("upload")}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                  imageMode === "upload"
                    ? "bg-violet-600/20 text-violet-400 border border-violet-500/30"
                    : "bg-white/[0.04] text-muted-foreground border border-white/[0.06] hover:bg-white/[0.08]"
                }`}
              >
                <Upload className="h-4 w-4" />
                {t("uploadUrl")}
              </button>
              <button
                type="button"
                onClick={() => setImageMode("generate")}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                  imageMode === "generate"
                    ? "bg-violet-600/20 text-violet-400 border border-violet-500/30"
                    : "bg-white/[0.04] text-muted-foreground border border-white/[0.06] hover:bg-white/[0.08]"
                }`}
              >
                <Sparkles className="h-4 w-4" />
                {t("generateAi")}
              </button>
            </div>

            {imageMode === "upload" ? (
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder={t("urlPlaceholder")}
              />
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder={t("promptPlaceholder")}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleGenerateImage}
                    disabled={!aiPrompt.trim() || isGenerating}
                    className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 shrink-0"
                  >
                    {isGenerating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Image preview */}
          {previewUrl && (
            <div className="space-y-2">
              <Label>{t("preview")}</Label>
              <div className="relative overflow-hidden rounded-lg border border-white/[0.06]">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-48 object-cover"
                />
              </div>
            </div>
          )}

          {!previewUrl && (
            <div className="flex flex-col items-center justify-center h-32 rounded-lg border border-dashed border-white/[0.1] text-muted-foreground">
              <ImageIcon className="h-8 w-8 mb-2 opacity-40" />
              <span className="text-xs">{t("noImage")}</span>
            </div>
          )}

          <Button
            onClick={handlePublish}
            disabled={!title.trim() || !message.trim() || isPublishing}
            className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 shadow-lg shadow-violet-500/20"
          >
            {isPublishing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("publishing")}
              </>
            ) : (
              t("publish")
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
