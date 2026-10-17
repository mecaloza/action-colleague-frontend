"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { LogOut, Menu, UserRound, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { SplashScreen } from "@/components/layout/splash-screen";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { homeFor, useAuth } from "@/contexts/auth-context";
import type { CurrentUser } from "@/lib/api/auth";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  exact?: boolean;
}

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Panel", exact: true },
  { href: "/admin/courses", label: "Cursos" },
  { href: "/admin/team", label: "Equipo" },
];

const LEARNER_NAV: NavItem[] = [
  { href: "/learn", label: "Mis cursos" },
  { href: "/profile", label: "Mi perfil" },
];

function isActive(pathname: string, { href, exact }: NavItem): boolean {
  return pathname === href || (!exact && pathname.startsWith(`${href}/`));
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function UserMenu({ user, onLogout }: { user: CurrentUser; onLogout: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Menú de ${user.name}`}
        className="hidden items-center gap-3 rounded-sm py-1 pl-1 pr-2 transition-colors hover:bg-mist md:flex"
      >
        <span className="flex h-8 w-8 items-center justify-center bg-ink-800 text-[11px] font-bold text-white">
          {initials(user.name)}
        </span>
        <span className="max-w-[160px] truncate text-sm font-semibold">{user.name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>
          <p className="text-sm font-semibold">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <UserRound /> Mi perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onLogout}>
          <LogOut /> Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface MobileMenuProps {
  nav: NavItem[];
  pathname: string;
  user: CurrentUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogout: () => void;
}

/** Full-screen menu for small screens (Radix Dialog: focus trap, Escape, scroll lock). */
function MobileMenu({ nav, pathname, user, open, onOpenChange, onLogout }: MobileMenuProps) {
  const close = () => onOpenChange(false);
  const links = nav.some((item) => item.href === "/profile") ? nav : [...nav, { href: "/profile", label: "Mi perfil" }];
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Trigger
        className="flex h-10 w-10 items-center justify-center md:hidden"
        aria-label="Abrir menú"
      >
        <Menu className="h-5 w-5" />
      </DialogPrimitive.Trigger>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Content forceMount asChild aria-describedby={undefined}>
              <motion.div
                className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-ink-950 text-white md:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <DialogPrimitive.Title className="sr-only">Menú principal</DialogPrimitive.Title>
                <div className="container flex h-16 shrink-0 items-center justify-between">
                  <Logo inverse />
                  <DialogPrimitive.Close className="flex h-10 w-10 items-center justify-center" aria-label="Cerrar menú">
                    <X className="h-5 w-5" />
                  </DialogPrimitive.Close>
                </div>
                <nav className="container mt-10 flex flex-col gap-2" aria-label="Principal">
                  {links.map((item, index) => {
                    const active = isActive(pathname, item);
                    return (
                      <motion.div
                        key={item.href}
                        initial={{ opacity: 0, x: -16 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.05 * index }}
                      >
                        <Link
                          href={item.href}
                          onClick={close}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "block py-2 font-display text-4xl font-medium tracking-tightest",
                            active ? "text-accent" : "text-white",
                          )}
                        >
                          {item.label}
                        </Link>
                      </motion.div>
                    );
                  })}
                </nav>
                <div className="container mt-auto border-t border-white/10 py-6">
                  <p className="text-sm font-semibold">{user.name}</p>
                  <p className="text-xs text-white/60">{user.email}</p>
                  <button
                    type="button"
                    onClick={onLogout}
                    className="mt-4 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-label text-accent"
                  >
                    <LogOut className="h-4 w-4" /> Cerrar sesión
                  </button>
                </div>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, status, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const signingOut = useRef(false);

  const lacksAdminAccess = pathname.startsWith("/admin") && user?.role !== "admin";

  useEffect(() => {
    if (status === "anonymous") {
      // After an explicit sign-out go to a clean /login; if the session expired, come back here after signing in.
      router.replace(signingOut.current ? "/login" : `/login?next=${encodeURIComponent(pathname)}`);
    } else if (status === "authenticated" && lacksAdminAccess) {
      router.replace(homeFor(user));
    }
  }, [status, user, lacksAdminAccess, pathname, router]);

  useEffect(() => setMenuOpen(false), [pathname]);

  if (status !== "authenticated" || !user || lacksAdminAccess) return <SplashScreen />;

  const nav = user.role === "admin" ? ADMIN_NAV : LEARNER_NAV;
  const handleLogout = () => {
    signingOut.current = true;
    setMenuOpen(false);
    logout();
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="container flex h-16 items-center justify-between gap-6">
          <Link href={homeFor(user)} className="shrink-0" aria-label="Inicio">
            <Logo />
          </Link>

          <nav className="hidden flex-1 items-center justify-center gap-10 md:flex" aria-label="Principal">
            {nav.map((item) => {
              const active = isActive(pathname, item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative py-1 text-[11.5px] font-bold uppercase tracking-label transition-colors hover:text-accent",
                    active ? "text-accent" : "text-ink-800",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <UserMenu user={user} onLogout={handleLogout} />
            <MobileMenu
              nav={nav}
              pathname={pathname}
              user={user}
              open={menuOpen}
              onOpenChange={setMenuOpen}
              onLogout={handleLogout}
            />
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border">
        <div className="container flex h-14 items-center justify-between text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Action Colleague</span>
          <span className="hidden sm:inline">Estudio de cursos</span>
        </div>
      </footer>
    </div>
  );
}
