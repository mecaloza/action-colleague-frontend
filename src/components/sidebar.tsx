"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  FileText,
  User,
  GraduationCap,
  X,
  Network,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const adminNav = [
  { href: "/admin/dashboard", label: "Panel Principal", icon: LayoutDashboard },
  { href: "/admin/courses", label: "Cursos", icon: BookOpen },
  { href: "/admin/employees", label: "Empleados", icon: Users },
  { href: "/admin/org-chart", label: "Organigrama", icon: Network },
  { href: "/admin/documents", label: "Documentos", icon: FileText },
];

const collaboratorNav = [
  { href: "/dashboard", label: "Mi Panel", icon: LayoutDashboard },
  { href: "/documents", label: "Mis Documentos", icon: FileText },
  { href: "/profile", label: "Perfil", icon: User },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const nav = user?.role === "admin" ? adminNav : collaboratorNav;

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={onClose} />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-white/[0.06] bg-[#0f0f1a]/80 backdrop-blur-2xl transition-transform duration-300 lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-white/[0.06] px-6">
          <Link href={user?.role === "admin" ? "/admin/dashboard" : "/dashboard"} className="flex items-center gap-2 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/20 transition-transform duration-200 group-hover:scale-110">
              <GraduationCap className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold gradient-text">Colleague</span>
          </Link>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 space-y-1 p-3 mt-2">
          {nav.map((item, i) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <motion.div
                key={item.href}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05, duration: 0.2 }}
              >
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-gradient-to-r from-violet-600/20 to-purple-600/10 text-white border border-violet-500/20 shadow-lg shadow-violet-500/10"
                      : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground hover:translate-x-1"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-gradient-to-b from-violet-400 to-purple-500"
                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    />
                  )}
                  <div className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200",
                    isActive
                      ? "bg-violet-500/20 text-violet-400"
                      : "text-muted-foreground group-hover:bg-white/[0.06] group-hover:text-violet-400"
                  )}>
                    <item.icon className="h-4 w-4" />
                  </div>
                  {item.label}
                </Link>
              </motion.div>
            );
          })}
        </nav>

        <div className="border-t border-white/[0.06] p-4">
          <div className="flex items-center gap-3 rounded-lg bg-white/[0.04] p-3 transition-all duration-200 hover:bg-white/[0.06]">
            <div className="relative">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-white text-sm font-semibold">
                {user?.name?.charAt(0) || "U"}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#0f0f1a] bg-emerald-500" />
            </div>
            <div className="flex-1 truncate">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{user?.role === "admin" ? "Administrador" : "Colaborador"}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
