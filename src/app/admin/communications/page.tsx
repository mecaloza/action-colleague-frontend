"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, Megaphone, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { Communication } from "@/lib/types";
import { CommunicationCard } from "@/components/communications/communication-card";
import { CreateCommunicationModal } from "@/components/communications/create-communication-modal";
import { useTranslations } from "next-intl";

export default function CommunicationsPage() {
  const t = useTranslations("adminCommunications");
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const fetchCommunications = useCallback(async () => {
    try {
      const data = await api.getCommunications();
      setCommunications(data);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCommunications();
  }, [fetchCommunications]);

  const handleDelete = async (id: number) => {
    if (!confirm(t("confirmDelete"))) return;
    try {
      await api.deleteCommunication(id);
      setCommunications((prev) => prev.filter((c) => c.id !== id));
    } catch {
      // silently handle
    }
  };

  const filtered = communications.filter(
    (c) =>
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.message.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-bold gradient-text"
          >
            {t("title")}
          </motion.h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 shadow-lg shadow-violet-500/20"
        >
          <Plus className="mr-2 h-4 w-4" />
          {t("create")}
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="pl-9"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/10 mb-4">
            <Megaphone className="h-8 w-8 text-violet-400" />
          </div>
          <h3 className="text-lg font-semibold text-white">{t("emptyTitle")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("emptySubtitle")}</p>
        </motion.div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((comm, i) => (
            <CommunicationCard
              key={comm.id}
              communication={comm}
              onDelete={handleDelete}
              index={i}
            />
          ))}
        </div>
      )}

      <CreateCommunicationModal
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={fetchCommunications}
      />
    </div>
  );
}
