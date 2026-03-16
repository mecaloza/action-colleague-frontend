"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Download,
  Loader2,
} from "lucide-react";
import html2canvas from "html2canvas";

export interface Slide {
  id: string;
  title: string;
  content: string;
  background: string;
}

export interface SlideEditorProps {
  onSlidesComplete: (slideImages: Blob[]) => void;
  className?: string;
}

export function SlideEditor({ onSlidesComplete, className = "" }: SlideEditorProps) {
  const [slides, setSlides] = useState<Slide[]>([
    {
      id: crypto.randomUUID(),
      title: "",
      content: "",
      background: "#1a1a2e",
    },
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const slideRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // ─── Slide Operations ────────────────────────────────────────────────────

  const addSlide = () => {
    const newSlide: Slide = {
      id: crypto.randomUUID(),
      title: "",
      content: "",
      background: "#1a1a2e",
    };
    setSlides([...slides, newSlide]);
    setCurrentSlide(slides.length);
  };

  const removeSlide = (index: number) => {
    if (slides.length === 1) return; // Keep at least one slide
    const newSlides = slides.filter((_, i) => i !== index);
    setSlides(newSlides);
    if (currentSlide >= newSlides.length) {
      setCurrentSlide(newSlides.length - 1);
    }
  };

  const moveSlide = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === slides.length - 1) return;

    const newSlides = [...slides];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    [newSlides[index], newSlides[targetIndex]] = [
      newSlides[targetIndex],
      newSlides[index],
    ];
    setSlides(newSlides);
    setCurrentSlide(targetIndex);
  };

  const updateSlide = (index: number, field: keyof Slide, value: string) => {
    const newSlides = [...slides];
    newSlides[index] = { ...newSlides[index], [field]: value };
    setSlides(newSlides);
  };

  // ─── Export to PNG ───────────────────────────────────────────────────────

  const exportSlides = async () => {
    setIsGenerating(true);

    try {
      const slideImages: Blob[] = [];

      for (const slide of slides) {
        const element = slideRefs.current.get(slide.id);
        if (!element) continue;

        // Capture slide as canvas
        const canvas = await html2canvas(element, {
          backgroundColor: slide.background,
          scale: 2, // Higher quality
          width: 1920,
          height: 1080,
          windowWidth: 1920,
          windowHeight: 1080,
        });

        // Convert to blob
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob);
              else reject(new Error("Failed to create blob"));
            },
            "image/png",
            1.0
          );
        });

        slideImages.push(blob);
      }

      onSlidesComplete(slideImages);
    } catch (error) {
      console.error("Error generating slides:", error);
      alert("Error al generar las slides. Por favor, intenta de nuevo.");
    } finally {
      setIsGenerating(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className={`grid gap-6 ${className}`}>
      {/* Editor Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Editor de Slides</span>
            <Button onClick={addSlide} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Agregar Slide
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Slide Thumbnails */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                onClick={() => setCurrentSlide(index)}
                className={`flex-shrink-0 w-32 h-20 rounded border-2 transition-all ${
                  currentSlide === index
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-border hover:border-primary/50"
                }`}
                style={{ backgroundColor: slide.background }}
              >
                <div className="p-2 h-full flex flex-col justify-center items-center text-white text-xs">
                  <div className="font-bold truncate w-full text-center">
                    {slide.title || `Slide ${index + 1}`}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Current Slide Editor */}
          {slides[currentSlide] && (
            <div className="space-y-4 p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">
                  Slide {currentSlide + 1} de {slides.length}
                </h3>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => moveSlide(currentSlide, "up")}
                    disabled={currentSlide === 0}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => moveSlide(currentSlide, "down")}
                    disabled={currentSlide === slides.length - 1}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeSlide(currentSlide)}
                    disabled={slides.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                {/* Title */}
                <div className="space-y-2">
                  <Label htmlFor={`title-${currentSlide}`}>Título</Label>
                  <Input
                    id={`title-${currentSlide}`}
                    placeholder="Título de la slide"
                    value={slides[currentSlide].title}
                    onChange={(e) =>
                      updateSlide(currentSlide, "title", e.target.value)
                    }
                  />
                </div>

                {/* Content */}
                <div className="space-y-2">
                  <Label htmlFor={`content-${currentSlide}`}>Contenido</Label>
                  <Textarea
                    id={`content-${currentSlide}`}
                    placeholder="Contenido de la slide"
                    value={slides[currentSlide].content}
                    onChange={(e) =>
                      updateSlide(currentSlide, "content", e.target.value)
                    }
                    rows={6}
                  />
                </div>

                {/* Background Color */}
                <div className="space-y-2">
                  <Label htmlFor={`bg-${currentSlide}`}>Color de Fondo</Label>
                  <div className="flex gap-2">
                    <Input
                      id={`bg-${currentSlide}`}
                      type="color"
                      value={slides[currentSlide].background}
                      onChange={(e) =>
                        updateSlide(currentSlide, "background", e.target.value)
                      }
                      className="w-20 h-10"
                    />
                    <Input
                      type="text"
                      value={slides[currentSlide].background}
                      onChange={(e) =>
                        updateSlide(currentSlide, "background", e.target.value)
                      }
                      placeholder="#1a1a2e"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Generate Button */}
          <Button
            onClick={exportSlides}
            disabled={isGenerating || slides.some((s) => !s.title && !s.content)}
            className="w-full gap-2"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Generando Presentación...
              </>
            ) : (
              <>
                <Download className="h-5 w-5" />
                Generar Presentación ({slides.length} slides)
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Hidden Preview Slides for Export */}
      <div className="fixed -left-[9999px] top-0">
        {slides.map((slide) => (
          <div
            key={slide.id}
            ref={(el) => {
              if (el) slideRefs.current.set(slide.id, el);
            }}
            style={{
              width: "1920px",
              height: "1080px",
              backgroundColor: slide.background,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              padding: "120px",
              fontFamily: "Arial, sans-serif",
            }}
          >
            {slide.title && (
              <h1
                style={{
                  fontSize: "96px",
                  fontWeight: "bold",
                  color: "#ffffff",
                  textAlign: "center",
                  marginBottom: "60px",
                  textShadow: "2px 2px 4px rgba(0,0,0,0.3)",
                }}
              >
                {slide.title}
              </h1>
            )}
            {slide.content && (
              <p
                style={{
                  fontSize: "48px",
                  color: "#ffffff",
                  textAlign: "center",
                  lineHeight: "1.6",
                  whiteSpace: "pre-wrap",
                  textShadow: "1px 1px 2px rgba(0,0,0,0.3)",
                }}
              >
                {slide.content}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
