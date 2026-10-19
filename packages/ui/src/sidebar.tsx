"use client";

import { BookOpen, Home, PanelLeftClose, PanelLeftOpen, Settings, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { useState } from "react";

export interface SidebarNavItem {
  label: string;
  href?: string;
  icon?: LucideIcon | ComponentType<{ className?: string }>;
  active?: boolean;
  onClick?: () => void;
}

export type NavItem = SidebarNavItem;
export type SidebarItem = SidebarNavItem;

export interface SidebarProps {
  items?: SidebarNavItem[];
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  onToggle?: (collapsed: boolean) => void;
  className?: string;
  header?: ReactNode;
  footer?: ReactNode;
  toggleLabel?: string;
}

const DEFAULT_ITEMS: SidebarNavItem[] = [
  { label: "Home", href: "/", icon: Home, active: true },
  { label: "Courses", href: "/courses", icon: BookOpen },
  { label: "Users", href: "/users", icon: Users },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar({
  items = DEFAULT_ITEMS,
  collapsed: controlledCollapsed,
  defaultCollapsed = false,
  onCollapsedChange,
  onToggle,
  className,
  header,
  footer,
  toggleLabel = "Toggle sidebar",
}: SidebarProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);
  const collapsed = controlledCollapsed === undefined ? internalCollapsed : controlledCollapsed;

  const setCollapsed = (next: boolean) => {
    if (controlledCollapsed === undefined) {
      setInternalCollapsed(next);
    }
    onCollapsedChange?.(next);
    onToggle?.(next);
  };

  const width = collapsed ? 64 : 260;

  return (
    <aside
      data-sidebar
      data-state={collapsed ? "collapsed" : "expanded"}
      style={{ width }}
      className={[
        "flex h-full shrink-0 flex-col border-r border-zinc-200 bg-white transition-[width] duration-200 ease-out dark:border-zinc-800 dark:bg-zinc-950",
        collapsed ? "w-[64px]" : "w-[260px]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-3">
        {!collapsed && header ? (
          <div className="min-w-0 flex-1">{header}</div>
        ) : !collapsed ? (
          <span className="truncate text-sm font-semibold">App</span>
        ) : null}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={toggleLabel}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-2 py-2">
        {items.map((item) => {
          const Icon = item.icon;
          const content = (
            <>
              {Icon ? <Icon className="h-5 w-5 shrink-0" /> : null}
              {!collapsed && <span className="truncate text-sm">{item.label}</span>}
            </>
          );
          const itemClassName = [
            "flex items-center gap-3 rounded-md px-2 py-2 text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
            item.active ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100" : "",
          ]
            .filter(Boolean)
            .join(" ");

          if (item.href) {
            return (
              <a
                key={`${item.label}-${item.href ?? ""}`}
                href={item.href}
                aria-current={item.active ? "page" : undefined}
                className={itemClassName}
                onClick={item.onClick}
              >
                {content}
              </a>
            );
          }

          return (
            <button
              key={`${item.label}-${item.href ?? ""}`}
              type="button"
              onClick={item.onClick}
              aria-current={item.active ? "page" : undefined}
              className={itemClassName}
            >
              {content}
            </button>
          );
        })}
      </nav>

      {footer ? <div className="px-3 py-3">{footer}</div> : null}
    </aside>
  );
}

export const SidebarNav = Sidebar;
export default Sidebar;
