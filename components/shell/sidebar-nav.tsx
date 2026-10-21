"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { navFor, type NavItem } from "@/lib/nav";
import { resolveHref } from "@/lib/role-routes";
import { cn } from "@/lib/utils";

interface Props {
  collapsed?: boolean;
  /** unique layoutId scope so desktop/mobile indicators never collide */
  scope: string;
  onNavigate?: () => void;
  onExpandRequest?: () => void;
}

export function SidebarNav({ collapsed = false, scope, onNavigate, onExpandRequest }: Props) {
  const pathname = usePathname();
  const { can, user } = useAuth();
  const items = navFor(user?.role, can).map((i) => (i.href ? { ...i, href: resolveHref(i.href, user?.home) } : i));
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const isGroupOpen = (item: NavItem) =>
    openGroups[item.label] ?? !!item.children?.some((c) => pathname === c.href || pathname.startsWith(c.href + "/"));

  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5 p-3">
      {items.map((item) => {
        const Icon = item.icon;
        if (item.children) {
          const open = isGroupOpen(item) && !collapsed;
          const childActive = item.children.some((c) => pathname === c.href);
          return (
            <div key={item.label}>
              <button
                type="button"
                title={collapsed ? item.label : undefined}
                aria-expanded={open}
                onClick={() => {
                  if (collapsed) {
                    onExpandRequest?.();
                    setOpenGroups((s) => ({ ...s, [item.label]: true }));
                  } else {
                    setOpenGroups((s) => ({ ...s, [item.label]: !isGroupOpen(item) }));
                  }
                }}
                className={cn(
                  "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white",
                  childActive && "text-white",
                  collapsed && "justify-center px-0",
                )}
              >
                <Icon className="size-5 shrink-0" aria-hidden />
                {!collapsed && (
                  <>
                    <span className="flex-1 truncate text-left">{item.label}</span>
                    <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
                  </>
                )}
              </button>
              <AnimatePresence initial={false}>
                {open && (
                  <motion.ul
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="ml-5 overflow-hidden border-l border-white/10 pl-2"
                  >
                    {item.children.map((c) => {
                      const active = pathname === c.href;
                      return (
                        <li key={c.href} className="relative">
                          {active && (
                            <motion.span
                              layoutId={`${scope}-active`}
                              className="absolute inset-0 rounded-lg bg-white/10"
                              transition={{ type: "spring", stiffness: 500, damping: 40 }}
                            />
                          )}
                          <Link
                            href={c.href}
                            onClick={onNavigate}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                              "relative flex h-9 items-center rounded-lg px-3 text-sm text-white/65 transition-colors hover:text-white",
                              active && "font-medium text-white",
                            )}
                          >
                            {c.label}
                          </Link>
                        </li>
                      );
                    })}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          );
        }

        const active = pathname === item.href;
        return (
          <div key={item.label} className="relative">
            {active && (
              <motion.span
                layoutId={`${scope}-active`}
                className="absolute inset-0 rounded-lg bg-white/10"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              >
                <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-accent" />
              </motion.span>
            )}
            <Link
              href={item.href!}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white",
                active && "text-white hover:bg-transparent",
                collapsed && "justify-center px-0",
              )}
            >
              <Icon className="size-5 shrink-0" aria-hidden />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}
