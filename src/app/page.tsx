"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SplashScreen } from "@/components/layout/splash-screen";
import { homeFor, useAuth } from "@/contexts/auth-context";

export default function Home() {
  const { user, status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
    else if (status === "authenticated") router.replace(homeFor(user));
  }, [status, user, router]);

  return <SplashScreen />;
}
