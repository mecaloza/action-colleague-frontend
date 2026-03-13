/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { OrgChartNode } from "@/lib/types";
import {
  ChevronDown,
  ChevronRight,
  Building2,
  User,
  Loader2,
  Search,
  Users,
  Mail,
  ArrowLeft,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

// Count total people in a subtree
function countNodes(node: OrgChartNode): number {
  return (
    1 + (node.children?.reduce((sum, c) => sum + countNodes(c), 0) || 0)
  );
}

// Find a node by id in the tree
function findNode(
  nodes: OrgChartNode[],
  id: string | number
): OrgChartNode | null {
  for (const n of nodes) {
    if (String(n.id) === String(id)) return n;
    if (n.children) {
      const found = findNode(n.children, id);
      if (found) return found;
    }
  }
  return null;
}

// Build breadcrumb path to a node
function buildPath(
  nodes: OrgChartNode[],
  targetId: string | number,
  current: OrgChartNode[] = []
): OrgChartNode[] | null {
  for (const n of nodes) {
    const path = [...current, n];
    if (String(n.id) === String(targetId)) return path;
    if (n.children) {
      const found = buildPath(n.children, targetId, path);
      if (found) return found;
    }
  }
  return null;
}

// Check if node or children match search
function matchesSearch(node: OrgChartNode, query: string): boolean {
  const q = query.toLowerCase();
  if (
    node.name.toLowerCase().includes(q) ||
    (node.position && node.position.toLowerCase().includes(q)) ||
    (node.department && node.department.toLowerCase().includes(q)) ||
    (node.email && node.email.toLowerCase().includes(q))
  )
    return true;
  return node.children?.some((c) => matchesSearch(c, q)) || false;
}

const DEPT_COLORS: Record<string, { bg: string; text: string; border: string }> =
  {
    "Human Resources": { bg: "bg-violet-500/15", text: "text-violet-400", border: "border-violet-500/30" },
    Engineering: { bg: "bg-blue-500/15", text: "text-blue-400", border: "border-blue-500/30" },
    Marketing: { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/30" },
    Finance: { bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/30" },
    Executive: { bg: "bg-rose-500/15", text: "text-rose-400", border: "border-rose-500/30" },
    HR: { bg: "bg-violet-500/15", text: "text-violet-400", border: "border-violet-500/30" },
    Operations: { bg: "bg-cyan-500/15", text: "text-cyan-400", border: "border-cyan-500/30" },
    Sales: { bg: "bg-orange-500/15", text: "text-orange-400", border: "border-orange-500/30" },
  };

function getDeptStyle(dept: string) {
  return DEPT_COLORS[dept] || { bg: "bg-white/10", text: "text-muted-foreground", border: "border-white/10" };
}

// ─── Detail Panel ────────────────────────────────────────────────────
function DetailPanel({
  node,
  onClose,
  onNavigate,
  tree,
}: {
  node: OrgChartNode;
  onClose: () => void;
  onNavigate: (id: string | number) => void;
  tree: OrgChartNode[];
}) {
  const path = buildPath(tree, node.id) || [];
  const deptStyle = getDeptStyle(node.department);
  const directReports = node.children || [];

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-[#12121f]/95 backdrop-blur-2xl border-l border-white/10 shadow-2xl overflow-y-auto animate-slide-in">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-white text-lg font-bold shadow-lg shadow-violet-500/30">
              {node.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </div>
            <div>
              <h2 className="text-lg font-bold">{node.name}</h2>
              <p className="text-sm text-muted-foreground">{node.position}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Breadcrumb */}
        {path.length > 1 && (
          <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            {path.map((p, i) => (
              <span key={p.id} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3" />}
                <button
                  onClick={() => onNavigate(p.id)}
                  className={cn(
                    "hover:text-violet-400 transition-colors",
                    String(p.id) === String(node.id) && "text-violet-400 font-medium"
                  )}
                >
                  {p.name.split(" ")[0]}
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Info */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge className={cn(deptStyle.bg, deptStyle.text, "border", deptStyle.border)}>
              <Building2 className="h-3 w-3 mr-1" />
              {node.department}
            </Badge>
            {node.role === "admin" && (
              <Badge variant="default">Admin</Badge>
            )}
          </div>

          {node.email && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" />
              {node.email}
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            {directReports.length} reportes directos · {countNodes(node) - 1} total en equipo
          </div>
        </div>

        {/* Manager */}
        {path.length > 1 && (
          <div>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Reporta a
            </h3>
            <button
              onClick={() => onNavigate(path[path.length - 2].id)}
              className="w-full flex items-center gap-3 p-3 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] transition-colors text-left"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-white text-xs font-semibold">
                {path[path.length - 2].name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </div>
              <div>
                <p className="text-sm font-medium">{path[path.length - 2].name}</p>
                <p className="text-xs text-muted-foreground">{path[path.length - 2].position}</p>
              </div>
            </button>
          </div>
        )}

        {/* Direct Reports */}
        {directReports.length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Reportes Directos ({directReports.length})
            </h3>
            <div className="space-y-1">
              {directReports.map((r) => {
                const rDept = getDeptStyle(r.department);
                return (
                  <button
                    key={r.id}
                    onClick={() => onNavigate(r.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] transition-colors text-left"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-white text-xs font-semibold">
                      {r.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.position}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", rDept.bg, rDept.text)}>
                        {r.department}
                      </span>
                      {r.children && r.children.length > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{countNodes(r) - 1}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Org Node ────────────────────────────────────────────────────────
function OrgNode({
  node,
  level = 0,
  search,
  onSelect,
  selectedId,
}: {
  node: OrgChartNode;
  level?: number;
  search: string;
  onSelect: (node: OrgChartNode) => void;
  selectedId?: string | number;
}) {
  const [expanded, setExpanded] = useState(level < 1);
  const hasChildren = node.children && node.children.length > 0;
  const deptStyle = getDeptStyle(node.department);
  const isSelected = String(node.id) === String(selectedId);
  const count = countNodes(node) - 1;

  // Auto-expand when searching
  useEffect(() => {
    if (search && hasChildren && matchesSearch(node, search)) {
      setExpanded(true);
    }
  }, [search, hasChildren, node]);

  // Skip rendering if doesn't match search
  if (search && !matchesSearch(node, search)) return null;

  return (
    <div className={cn("relative", level > 0 && "ml-6 md:ml-8")}>
      {/* Connector */}
      {level > 0 && (
        <div className="absolute -left-6 md:-left-8 top-0 h-7 w-6 md:w-8">
          <div className="absolute left-0 top-0 h-7 w-0.5 bg-white/10" />
          <div className="absolute left-0 top-7 h-0.5 w-full bg-white/10" />
        </div>
      )}

      {/* Node */}
      <div className="mb-2">
        <button
          onClick={() => onSelect(node)}
          className={cn(
            "inline-flex items-center gap-3 rounded-xl border p-3 pr-4 transition-all duration-200 text-left",
            isSelected
              ? "border-violet-500/40 bg-violet-500/10 glow-violet-sm"
              : "border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/[0.15]"
          )}
        >
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white text-sm font-semibold shadow-lg",
              level === 0
                ? "bg-gradient-to-br from-rose-500 to-pink-600"
                : level === 1
                ? "bg-gradient-to-br from-violet-500 to-purple-600"
                : "bg-gradient-to-br from-blue-500 to-indigo-600"
            )}
          >
            {node.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight">{node.name}</p>
            <p className="text-xs text-muted-foreground">{node.position}</p>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                  deptStyle.bg,
                  deptStyle.text
                )}
              >
                {node.department}
              </span>
              {hasChildren && (
                <span className="text-[10px] text-muted-foreground">
                  {count} persona{count !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
          {hasChildren && (
            <Button
              variant="ghost"
              size="icon"
              className="ml-1 h-7 w-7 shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          )}
        </button>
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div className="relative">
          {(node.children?.length ?? 0) > 1 && (
            <div
              className="absolute left-0 w-0.5 bg-white/10"
              style={{ top: 0, height: "calc(100% - 0.5rem)" }}
            />
          )}
          {node.children?.map((child) => (
            <OrgNode
              key={child.id}
              node={child}
              level={level + 1}
              search={search}
              onSelect={onSelect}
              selectedId={selectedId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────
export default function OrgChartPage() {
  const t = useTranslations("adminOrgChart");
  const [tree, setTree] = useState<OrgChartNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<OrgChartNode | null>(null);
  const [focusRoot, setFocusRoot] = useState<OrgChartNode[] | null>(null);
  const [focusLabel, setFocusLabel] = useState("");

  useEffect(() => {
    api
      .getOrgChart()
      .then(setTree)
      .catch(() => setTree([]))
      .finally(() => setLoading(false));
  }, []);

  // Get all unique departments
  const departments = useMemo(() => {
    const depts = new Set<string>();
    function walk(nodes: OrgChartNode[]) {
      for (const n of nodes) {
        if (n.department) depts.add(n.department);
        if (n.children) walk(n.children);
      }
    }
    walk(tree);
    return Array.from(depts).sort();
  }, [tree]);

  // Total count
  const totalPeople = useMemo(() => {
    return tree.reduce((sum, n) => sum + countNodes(n), 0);
  }, [tree]);

  const handleNavigate = useCallback(
    (id: string | number) => {
      const node = findNode(tree, id);
      if (node) setSelected(node);
    },
    [tree]
  );

  const handleFocusDepartment = (dept: string) => {
    // Find all subtrees where the root has this department
    function collect(nodes: OrgChartNode[]): OrgChartNode[] {
      const result: OrgChartNode[] = [];
      for (const n of nodes) {
        if (n.department === dept) result.push(n);
        else if (n.children) result.push(...collect(n.children));
      }
      return result;
    }
    const nodes = collect(tree);
    if (nodes.length > 0) {
      setFocusRoot(nodes);
      setFocusLabel(dept);
    }
  };

  const displayTree = focusRoot || tree;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">
            {t("summary", { people: totalPeople, departments: departments.length })}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Department chips */}
      <div className="flex flex-wrap gap-2">
        {focusRoot && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFocusRoot(null);
              setFocusLabel("");
            }}
            className="border-violet-500/30 text-violet-400"
          >
            <ArrowLeft className="h-3 w-3 mr-1" />
            {t("viewAll")}
          </Button>
        )}
        {departments.map((dept) => {
          const ds = getDeptStyle(dept);
          const isFocused = focusLabel === dept;
          return (
            <button
              key={dept}
              onClick={() =>
                isFocused
                  ? (setFocusRoot(null), setFocusLabel(""))
                  : handleFocusDepartment(dept)
              }
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                isFocused
                  ? cn(ds.bg, ds.text, "ring-1", ds.border)
                  : "bg-white/[0.05] text-muted-foreground hover:bg-white/[0.1]"
              )}
            >
              <Building2 className="h-3 w-3" />
              {dept}
            </button>
          );
        })}
      </div>

      {/* Tree */}
      {displayTree.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <User className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">Sin datos de jerarquía</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {t("empty")}
          </p>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl p-4 md:p-6">
          {displayTree.map((root) => (
            <OrgNode
              key={root.id}
              node={root}
              search={search}
              onSelect={setSelected}
              selectedId={selected?.id}
            />
          ))}
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setSelected(null)}
          />
          <DetailPanel
            node={selected}
            tree={tree}
            onClose={() => setSelected(null)}
            onNavigate={handleNavigate}
          />
        </>
      )}
    </div>
  );
}
