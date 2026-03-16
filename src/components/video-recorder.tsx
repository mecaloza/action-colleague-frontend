"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Video,
  Square,
  RotateCcw,
  Loader2,
  Camera,
  Mic,
  AlertCircle,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VideoRecorderProps {
  onRecordingComplete: (blob: Blob, duration: number) => void;
  maxDuration?: number; // seconds
  className?: string;
}

type RecordingState = "idle" | "countdown" | "recording" | "stopped" | "error";

interface PermissionState {
  camera: boolean;
  microphone: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function VideoRecorder({
  onRecordingComplete,
  maxDuration = 1800, // 30 minutes default
  className = "",
}: VideoRecorderProps) {
  // State
  const [state, setState] = useState<RecordingState>("idle");
  const [countdown, setCountdown] = useState<number>(3);
  const [duration, setDuration] = useState<number>(0);
  const [permissions, setPermissions] = useState<PermissionState>({
    camera: false,
    microphone: false,
  });
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [audioLevel, setAudioLevel] = useState<number>(0);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // ─── Initialize Media Stream ─────────────────────────────────────────────

  const initializeStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode: "user",
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setPermissions({ camera: true, microphone: true });
      setState("idle");

      // Setup audio level monitoring
      setupAudioMonitoring(stream);
    } catch (error) {
      console.error("Error accessing media devices:", error);
      setErrorMessage(
        "No se pudo acceder a la cámara o micrófono. Verifica los permisos."
      );
      setState("error");
      setPermissions({ camera: false, microphone: false });
    }
  }, []);

  // ─── Audio Level Monitoring ──────────────────────────────────────────────

  const setupAudioMonitoring = (stream: MediaStream) => {
    try {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);

      analyser.fftSize = 256;
      microphone.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      updateAudioLevel();
    } catch (error) {
      console.error("Error setting up audio monitoring:", error);
    }
  };

  const updateAudioLevel = () => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    const normalized = Math.min(100, (average / 128) * 100);

    setAudioLevel(normalized);

    animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
  };

  // ─── Start Recording ─────────────────────────────────────────────────────

  const startRecording = useCallback(() => {
    if (!streamRef.current) {
      setErrorMessage("No hay stream de video disponible");
      return;
    }

    // Start countdown
    setState("countdown");
    setCountdown(3);

    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current!);
          beginRecording();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const beginRecording = () => {
    if (!streamRef.current) return;

    try {
      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType: "video/webm;codecs=vp9,opus",
      });

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        onRecordingComplete(blob, duration);
        setState("stopped");
      };

      mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event);
        setErrorMessage("Error durante la grabación");
        setState("error");
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100); // Collect data every 100ms

      setState("recording");
      setDuration(0);

      // Start timer
      timerIntervalRef.current = setInterval(() => {
        setDuration((prev) => {
          const newDuration = prev + 1;
          if (newDuration >= maxDuration) {
            stopRecording();
          }
          return newDuration;
        });
      }, 1000);
    } catch (error) {
      console.error("Error starting recording:", error);
      setErrorMessage("Error al iniciar la grabación");
      setState("error");
    }
  };

  // ─── Stop Recording ──────────────────────────────────────────────────────

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state === "recording") {
      mediaRecorderRef.current.stop();
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
  }, [state]);

  // ─── Reset ───────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    if (state === "recording") {
      stopRecording();
    }

    chunksRef.current = [];
    setDuration(0);
    setState("idle");
  }, [state, stopRecording]);

  // ─── Cleanup ─────────────────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
  }, []);

  // ─── Effects ─────────────────────────────────────────────────────────────

  useEffect(() => {
    initializeStream();
    return cleanup;
  }, [initializeStream, cleanup]);

  // ─── Helpers ─────────────────────────────────────────────────────────────

  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getMaxTimeFormatted = (): string => {
    return formatTime(maxDuration);
  };

  // ─── Render Audio Level Bars ─────────────────────────────────────────────

  const renderAudioLevel = () => {
    const bars = 8;
    const filledBars = Math.ceil((audioLevel / 100) * bars);

    return (
      <div className="flex items-center gap-1">
        {Array.from({ length: bars }).map((_, i) => (
          <div
            key={i}
            className={`w-1 h-3 rounded-sm transition-colors ${
              i < filledBars
                ? audioLevel > 80
                  ? "bg-green-500"
                  : audioLevel > 50
                    ? "bg-yellow-500"
                    : "bg-blue-500"
                : "bg-gray-300 dark:bg-gray-700"
            }`}
          />
        ))}
      </div>
    );
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  if (state === "error") {
    return (
      <Card className={className}>
        <CardContent className="p-8">
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <div className="rounded-full bg-red-100 dark:bg-red-900/20 p-3">
              <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Error de Permisos</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {errorMessage}
              </p>
              <Button onClick={initializeStream}>Reintentar</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardContent className="p-6">
        {/* Video Preview */}
        <div className="relative mb-6 rounded-lg overflow-hidden bg-black aspect-video">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />

          {/* Countdown Overlay */}
          {state === "countdown" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="text-white text-9xl font-bold animate-pulse">
                {countdown}
              </div>
            </div>
          )}

          {/* Recording Indicator */}
          {state === "recording" && (
            <div className="absolute top-4 left-4">
              <Badge variant="destructive" className="gap-2 animate-pulse">
                <div className="w-2 h-2 rounded-full bg-white" />
                GRABANDO
              </Badge>
            </div>
          )}

          {/* Permission Indicators */}
          <div className="absolute top-4 right-4 flex gap-2">
            <div
              className={`p-2 rounded-full ${
                permissions.camera
                  ? "bg-green-500/80"
                  : "bg-gray-500/80"
              }`}
            >
              <Camera className="h-4 w-4 text-white" />
            </div>
            <div
              className={`p-2 rounded-full ${
                permissions.microphone
                  ? "bg-green-500/80"
                  : "bg-gray-500/80"
              }`}
            >
              <Mic className="h-4 w-4 text-white" />
            </div>
          </div>
        </div>

        {/* Status Bar */}
        <div className="flex items-center justify-between mb-6 p-4 rounded-lg bg-muted">
          <div className="flex items-center gap-4">
            {/* Timer */}
            <div className="flex items-center gap-2">
              <span className="text-2xl font-mono font-bold">
                {formatTime(duration)}
              </span>
              <span className="text-sm text-muted-foreground">
                / {getMaxTimeFormatted()}
              </span>
            </div>

            {/* Audio Level */}
            <div className="flex items-center gap-2">
              <Mic className="h-4 w-4 text-muted-foreground" />
              {renderAudioLevel()}
              <span className="text-xs text-muted-foreground">
                {audioLevel > 10 ? "Audio OK" : "Muy bajo"}
              </span>
            </div>
          </div>

          {/* Recording State Badge */}
          {state === "recording" && (
            <Badge variant="default">En grabación</Badge>
          )}
          {state === "stopped" && (
            <Badge variant="secondary">Grabación completada</Badge>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3">
          {state === "idle" && (
            <Button
              onClick={startRecording}
              size="lg"
              className="gap-2"
              disabled={!permissions.camera || !permissions.microphone}
            >
              <Video className="h-5 w-5" />
              Grabar
            </Button>
          )}

          {state === "countdown" && (
            <Button size="lg" disabled>
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Iniciando...
            </Button>
          )}

          {state === "recording" && (
            <>
              <Button
                onClick={stopRecording}
                size="lg"
                variant="destructive"
                className="gap-2"
              >
                <Square className="h-5 w-5" />
                Detener
              </Button>
            </>
          )}

          {(state === "stopped" || state === "idle") && duration > 0 && (
            <Button onClick={reset} size="lg" variant="outline" className="gap-2">
              <RotateCcw className="h-5 w-5" />
              Reiniciar
            </Button>
          )}
        </div>

        {/* Help Text */}
        {state === "idle" && permissions.camera && permissions.microphone && (
          <p className="text-center text-sm text-muted-foreground mt-4">
            Haz clic en &quot;Grabar&quot; para comenzar. Tendrás una cuenta regresiva de 3 segundos.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
