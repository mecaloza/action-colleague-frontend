"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";
import { GraduationCap, Loader2, AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";

export default function LoginPage() {
  const t = useTranslations("login");
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
      const savedUser = localStorage.getItem("ac_user");
      if (savedUser) {
        const userData = JSON.parse(savedUser);
        router.push(
          userData.role === "admin" ? "/admin/dashboard" : "/dashboard"
        );
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("errors.failed")
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#0f0f1a] via-[#1a1a2e] to-[#16132b] p-4 relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-1/4 -left-20 h-72 w-72 rounded-full bg-violet-600/20 blur-[100px]" />
        <div className="absolute bottom-1/4 -right-20 h-72 w-72 rounded-full bg-purple-600/20 blur-[100px]" />
      </div>

      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      <div className="mb-8 flex items-center gap-3 animate-fade-in relative z-10">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/30">
          <GraduationCap className="h-6 w-6 text-white" />
        </div>
        <h1 className="text-3xl font-bold gradient-text">Action Colleague</h1>
      </div>

      <p className="mb-8 text-center text-muted-foreground animate-fade-in relative z-10">
        {t("subtitle")}
      </p>

      <Card className="w-full max-w-md glass-strong glow-violet animate-slide-up relative z-10">
        <CardHeader>
          <CardTitle className="text-center text-xl">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t("emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t("password")}</Label>
              <Input
                id="password"
                type="password"
                placeholder={t("passwordPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={loading}
              />
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("signingIn")}
                </>
              ) : (
                t("title")
              )}
            </Button>
          </form>

          <div className="mt-6 rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              {t("demo.title")}
            </p>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>
                <span className="font-medium text-violet-400">{t("demo.admin")}:</span>{" "}
                admin@actioncolleague.com / admin123
              </p>
              <p>
                <span className="font-medium text-violet-400">{t("demo.collaborator")}:</span>{" "}
                carlos.lopez@actioncolleague.com / password123
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
