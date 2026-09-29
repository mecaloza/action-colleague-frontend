"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/auth-context";
import { LanguageProvider } from "@/contexts/language-context";
import { ApiError } from "@/lib/api/client";

const TOAST_OPTIONS = {
  classNames: {
    toast: "rounded-sm border border-border font-sans shadow-xl",
    title: "font-semibold",
  },
};

const isClientError = (error: unknown) => error instanceof ApiError && error.status >= 400 && error.status < 500;

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Do not retry client errors (403/404/422); retry transient failures once.
        retry: (failureCount, error) => failureCount < 1 && !isClientError(error),
      },
    },
  });
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <MotionConfig reducedMotion="user">
            <TooltipProvider delayDuration={200}>
              {children}
              <Toaster position="bottom-right" toastOptions={TOAST_OPTIONS} />
            </TooltipProvider>
          </MotionConfig>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}
