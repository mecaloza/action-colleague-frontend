"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Search,
  Film,
  Layers,
  ChevronRight,
  Clapperboard,
  Trash2,
} from "lucide-react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://colleague-backend-production.up.railway.app/api/v1";

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("ac_token") || "";
}

interface Series {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  episodes: { id: string; scenes: unknown[] }[];
  created_at: string;
}

const categoryColors: Record<string, string> = {
  caso: "bg-amber-500/20 text-amber-400 border-amber-500/20",
  onboarding: "bg-violet-500/20 text-violet-400 border-violet-500/20",
  compliance: "bg-blue-500/20 text-blue-400 border-blue-500/20",
  custom: "bg-emerald-500/20 text-emerald-400 border-emerald-500/20",
};

const categoryLabels: Record<string, string> = {
  caso: "Caso",
  onboarding: "Onboarding",
  compliance: "Compliance",
  custom: "Personalizado",
};

const statusVariant = (status: string) => {
  switch (status) {
    case "completed":
      return "success" as const;
    case "generating":
      return "default" as const;
    case "draft":
      return "secondary" as const;
    case "error":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
};

const statusLabel = (status: string) => {
  switch (status) {
    case "completed":
      return "Completada";
    case "generating":
      return "Generando";
    case "draft":
      return "Borrador";
    case "error":
      return "Error";
    default:
      return status;
  }
};

export default function AdminSeriesPage() {
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSeries();
  }, []);

  const fetchSeries = async () => {
    try {
      const res = await fetch(`${API_BASE}/series/ai/`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("Failed to fetch series");
      const data = await res.json();
      setSeriesList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error loading series:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("¿Estás seguro de eliminar esta micro-serie?")) return;
    try {
      await fetch(`${API_BASE}/series/ai/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setSeriesList((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error("Error deleting series:", err);
    }
  };

  const filtered = seriesList.filter(
    (s) =>
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Micro-Series</h1>
          <p className="text-muted-foreground">
            Series de micro-episodios generados con IA
          </p>
        </div>
        <Link href="/admin/series/create">
          <Button variant="default">
            <Plus className="mr-2 h-4 w-4" /> Crear Micro-Serie
          </Button>
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar micro-series..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <Clapperboard className="h-8 w-8 text-violet-400 animate-pulse" />
            <p className="text-sm text-muted-foreground">
              Cargando micro-series...
            </p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Film className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No hay micro-series</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Crea tu primera micro-serie con IA
          </p>
          <Link href="/admin/series/create">
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Crear Micro-Serie
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((series) => (
            <Link key={series.id} href={`/admin/series/${series.id}`}>
              <Card className="h-full cursor-pointer group hover:glow-violet-sm hover:scale-[1.02] transition-all duration-300">
                <div className="h-32 rounded-t-lg bg-gradient-to-br from-violet-600/30 to-purple-800/20 flex items-center justify-center border-b border-white/[0.06] relative">
                  <Clapperboard className="h-10 w-10 text-violet-400/30" />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => handleDelete(e, series.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <CardHeader className="pt-4">
                  <div className="flex items-start justify-between">
                    <Badge variant={statusVariant(series.status)}>
                      {statusLabel(series.status)}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-violet-400 transition-colors" />
                  </div>
                  <CardTitle className="text-lg">{series.title}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {series.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Layers className="h-3.5 w-3.5" />
                      {series.episodes?.length || 0} episodios
                    </div>
                  </div>
                  <div
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold mt-3 ${
                      categoryColors[series.category] ||
                      "bg-white/10 text-muted-foreground border-white/10"
                    }`}
                  >
                    {categoryLabels[series.category] || series.category}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
