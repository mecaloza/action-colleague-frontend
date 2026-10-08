"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { House, LogOut, Menu, SlidersHorizontal, Trophy, UserRound, X, type LucideIcon } from "lucide-react";
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
import { learnApi, learnKeys } from "@/lib/api/learn";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  exact?: boolean;
  /** Its place in a learner's tab bar (phones and tablets): a shorter name and an icon. */
  tab?: { label: string; icon: LucideIcon };
}

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Panel", exact: true },
  { href: "/admin/paths", label: "Rutas" },
  { href: "/admin/courses", label: "Cursos" },
  { href: "/admin/team", label: "Equipo" },
  { href: "/admin/certificates", label: "Certificados" },
];

/** The platform's parameters: in the admin's own menu, not in the main nav (they are set once, seldom changed). */
const SETTINGS_ITEM: NavItem = { href: "/admin/settings", label: "Parámetros" };
const PROFILE_ITEM: NavItem = { href: "/profile", label: "Mi perfil", tab: { label: "Perfil", icon: UserRound } };

const LEARNER_HOME: NavItem = { href: "/learn", label: "Mis cursos", tab: { label: "Inicio", icon: House } };
/** Only while the parameters show it to collaborators. */
const RANKING_ITEM: NavItem = { href: "/learn/ranking", label: "Ranking", tab: { label: "Ranking", icon: Trophy } };

function matches(pathname: string, { href, exact }: NavItem): boolean {
  return pathname === href || (!exact && pathname.startsWith(`${href}/`));
}

/**
 * The item of the page on screen: the most specific one that matches, so a section with an item of its own under
 * another one's prefix (a future `/learn/ranking`) never lights up both. Its pages (`/learn/12`) keep the parent's.
 */
function activeItem(pathname: string, nav: NavItem[]): NavItem | undefined {
  return nav
    .filter((item) => matches(pathname, item))
    .reduce<NavItem | undefined>((best, item) => (!best || item.href.length > best.href.length ? item : best), undefined);
}

/** The user's own menu (their profile, signing out). Admins have it from lg (below, their full menu holds it); a
 * learner, whose sections go in the tab bar below lg, always: just the initials on a phone. */
function UserMenu({ user, onLogout }: { user: CurrentUser; onLogout: () => void }) {
  const learner = user.role !== "admin";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Menú de ${user.name}`}
        className={cn(
          "min-h-10 items-center gap-3 rounded-sm py-1 pl-1 pr-2 transition-colors hover:bg-mist",
          learner ? "flex" : "hidden lg:flex",
        )}
      >
        <span className="flex h-8 w-8 items-center justify-center bg-ink-800 text-[11px] font-bold text-white">
          {initials(user.name)}
        </span>
        <span className={cn("max-w-[160px] truncate text-sm font-semibold", learner && "hidden sm:inline")}>{user.name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>
          <p className="text-sm font-semibold">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {user.role === "admin" && (
          <DropdownMenuItem asChild>
            <Link href={SETTINGS_ITEM.href}>
              <SlidersHorizontal /> {SETTINGS_ITEM.label}
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href={PROFILE_ITEM.href}>
            <UserRound /> {PROFILE_ITEM.label}
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

/** Full-screen menu for small screens and tablets (Radix Dialog: focus trap, Escape, scroll lock). */
function MobileMenu({ nav, pathname, user, open, onOpenChange, onLogout }: MobileMenuProps) {
  const close = () => onOpenChange(false);
  // What the desktop keeps in the user's menu: here, after the sections.
  const links = [
    ...nav,
    ...(user.role === "admin" ? [SETTINGS_ITEM] : []),
    ...(nav.includes(PROFILE_ITEM) ? [] : [PROFILE_ITEM]),
  ];
  const active = activeItem(pathname, links);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Trigger
        className="flex h-10 w-10 items-center justify-center lg:hidden"
        aria-label="Abrir menú"
      >
        <Menu className="h-5 w-5" />
      </DialogPrimitive.Trigger>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Content forceMount asChild aria-describedby={undefined}>
              <motion.div
                className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-ink-950 text-white lg:hidden"
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
                    const current = item === active;
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
                          aria-current={current ? "page" : undefined}
                          className={cn(
                            "block py-2 font-display text-4xl font-medium tracking-tightest",
                            current ? "text-accent" : "text-white",
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
                    className="mt-2 inline-flex min-h-10 items-center gap-2 text-[11px] font-bold uppercase tracking-label text-accent"
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

interface TabBarProps {
  nav: NavItem[];
  pathname: string;
  /** An item whose place is kept, unseen and out of reach, until it is known whether it shows. */
  held?: NavItem;
}

/**
 * A learner's sections at the bottom of the screen, below lg (where the header has no room for them): within reach of
 * the thumb, clear of the home bar. `data-tab-bar` publishes its height (`--tab-bar`, globals.css): what sticks to the
 * bottom of the page, and the toasts, keep above it.
 */
function TabBar({ nav, pathname, held }: TabBarProps) {
  const active = activeItem(pathname, nav);
  return (
    <nav
      aria-label="Principal"
      data-tab-bar
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] backdrop-blur supports-[backdrop-filter]:bg-white/85 lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg">
        {nav.map((item) => {
          const current = item === active;
          const Icon = item.tab?.icon ?? House;
          return (
            <li key={item.href} className={cn("flex-1", item === held && "invisible")}>
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-bold uppercase tracking-label transition-colors",
                  current ? "text-accent-strong" : "text-ink-700 hover:text-accent-strong",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {item.tab?.label ?? item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, status, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const signingOut = useRef(false);

  const lacksAdminAccess = pathname.startsWith("/admin") && user?.role !== "admin";
  const isLearner = status === "authenticated" && user?.role !== "admin";
  // "Ranking" shows only once the parameters say collaborators see it: never by mistake, while they are asked or if
  // they can't be read. While asked, its place is kept: when it comes (as it usually does) nothing in the nav moves.
  const learnerSettings = useQuery({ queryKey: learnKeys.settings, queryFn: learnApi.settings, enabled: isLearner });
  const held = isLearner && learnerSettings.isPending ? RANKING_ITEM : undefined;
  const withRanking = held !== undefined || learnerSettings.data?.ranking_visible === true;

  useEffect(() => {
    if (status === "anonymous") {
      // After an explicit sign-out go to a clean /login; if the session expired, come back here after signing in.
      const here = `${pathname}${window.location.search}`; // e.g. the course player's ?m=
      router.replace(signingOut.current ? "/login" : `/login?next=${encodeURIComponent(here)}`);
    } else if (status === "authenticated" && lacksAdminAccess) {
      router.replace(homeFor(user));
    }
  }, [status, user, lacksAdminAccess, pathname, router]);

  useEffect(() => setMenuOpen(false), [pathname]);

  if (status !== "authenticated" || !user || lacksAdminAccess) return <SplashScreen />;

  const nav = isLearner ? [LEARNER_HOME, ...(withRanking ? [RANKING_ITEM] : []), PROFILE_ITEM] : ADMIN_NAV;
  const active = activeItem(pathname, nav);
  const handleLogout = () => {
    signingOut.current = true;
    setMenuOpen(false);
    logout();
  };

  return (
    // A learner's tab bar covers the bottom of the screen: the page ends above it.
    <div className={cn("flex min-h-dvh flex-col bg-background", isLearner && "pb-[var(--tab-bar,0px)]")}>
      <header className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="container flex h-16 items-center justify-between gap-6">
          <Link href={homeFor(user)} className="shrink-0" aria-label="Inicio">
            <Logo />
          </Link>

          {/* Five items and the user's name only fit side by side from lg: below, the menu (an admin's) or the tab bar
              (a learner's) holds them. */}
          <nav className="hidden flex-1 items-center justify-center gap-8 lg:flex" aria-label="Principal">
            {nav.map((item) => {
              const current = item === active;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "relative py-1 text-[11.5px] font-bold uppercase tracking-label transition-colors hover:text-accent",
                    current ? "text-accent" : "text-ink-800",
                    item === held && "invisible",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <UserMenu user={user} onLogout={handleLogout} />
            {!isLearner && (
              <MobileMenu
                nav={nav}
                pathname={pathname}
                user={user}
                open={menuOpen}
                onOpenChange={setMenuOpen}
                onLogout={handleLogout}
              />
            )}
          </div>
        </div>
      </header>
      {/* Fixed at the bottom, but right after the header for keyboards and screen readers (as the header's nav). */}
      {isLearner && <TabBar nav={nav} pathname={pathname} held={held} />}

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border">
        <div className="container flex h-14 items-center justify-between text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Rubinstein Colleague</span>
          <span className="hidden sm:inline">Estudio de cursos</span>
        </div>
      </footer>
    </div>
  );
}
