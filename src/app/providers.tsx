"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";
import { Toaster } from "sonner";
import { ConfirmProvider } from "@/components/layout/confirm-dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/auth-context";
import { ApiError } from "@/lib/api/client";
import { PHONE, useMediaQuery } from "@/lib/hooks/use-media-query";

const TOAST_OPTIONS = {
  classNames: {
    toast: "rounded-sm border border-border font-sans shadow-xl",
    title: "font-semibold",
  },
};
// On a phone, toasts at the top (clear of the notch): at the bottom they would cover a panel's buttons.
const PHONE_TOAST_OFFSET = { top: "max(16px, env(safe-area-inset-top))" };
// Elsewhere at the bottom, above a learner's tab bar when there is one (`--tab-bar`, globals.css).
const TOAST_OFFSET = { bottom: "calc(24px + var(--tab-bar, 0px))" };

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
  const phone = useMediaQuery(PHONE);
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MotionConfig reducedMotion="user">
          <TooltipProvider delayDuration={200}>
            <ConfirmProvider>
              {children}
              <Toaster
                position={phone ? "top-center" : "bottom-right"}
                offset={TOAST_OFFSET}
                mobileOffset={PHONE_TOAST_OFFSET}
                toastOptions={TOAST_OPTIONS}
              />
            </ConfirmProvider>
          </TooltipProvider>
        </MotionConfig>
      </AuthProvider>
    </QueryClientProvider>
  );
}
