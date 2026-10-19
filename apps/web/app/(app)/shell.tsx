"use client";

import { Sidebar } from "@lagan/ui";
import { ChevronDown, Search, User } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { authClient } from "../../lib/auth-client";
import { COURSE_CATEGORY_OPTIONS } from "./courses/params";
import { NotificationCenter } from "../../components/notification-center";
const COURSES_PATH = "/courses";
const SEARCH_DEBOUNCE_MS = 300;

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isCatalogue = pathname === COURSES_PATH;

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  // Last value this shell pushed to the URL. Lets the input ignore the URL echo of
  // its own navigation without fighting a user who is still typing.
  const appliedQuery = useRef<string | null>(null);
  const appliedCategory = useRef<string | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [accountMenuOpen]);

  const handleSignOut = async () => {
    setAccountMenuOpen(false);
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  };
  useEffect(() => {
    if (!isCatalogue) return;

    const nextQuery = searchParams.get("q") ?? "";
    if (nextQuery !== appliedQuery.current) {
      appliedQuery.current = nextQuery;
      setQuery(nextQuery);
    }

    const nextCategory = searchParams.get("category") ?? "all";
    if (nextCategory !== appliedCategory.current) {
      appliedCategory.current = nextCategory;
      setCategory(nextCategory);
    }
  }, [isCatalogue, searchParams]);

  const applyParams = useCallback(
    (patch: { q?: string; category?: string }) => {
      const next = isCatalogue
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams();
      if (patch.q !== undefined) {
        if (patch.q) next.set("q", patch.q);
        else next.delete("q");
      }
      if (patch.category !== undefined) {
        if (patch.category && patch.category !== "all") next.set("category", patch.category);
        else next.delete("category");
      }
      next.delete("page");

      const search = next.toString();
      const target = search ? `${COURSES_PATH}?${search}` : COURSES_PATH;
      if (isCatalogue) {
        router.replace(target, { scroll: false });
      } else {
        router.push(target);
      }
    },
    [isCatalogue, router],
  );
  useEffect(() => {
    if (!isCatalogue || query === appliedQuery.current) return;

    const timer = setTimeout(() => {
      appliedQuery.current = query;
      applyParams({ q: query });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [applyParams, isCatalogue, query]);

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    appliedQuery.current = query;
    applyParams({ q: query });
  };

  const selectCategory = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    appliedCategory.current = value;
    setCategory(value);
    applyParams({ category: value });
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <Sidebar collapsed={collapsed} onCollapsedChange={setCollapsed} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-950">
          <search className="relative flex-1 max-w-xl">
            <form onSubmit={submitSearch}>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="search"
                name="q"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                autoComplete="off"
                aria-label="Search courses, lessons, people"
                placeholder="Search courses, lessons, people…"
                className="h-10 w-full rounded-md border border-zinc-200 bg-zinc-50 pl-9 pr-12 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-zinc-600 dark:focus:bg-zinc-950"
              />
              <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                ⌘K
              </kbd>
            </form>
          </search>

          <div className="relative">
            <select
              value={category}
              onChange={selectCategory}
              aria-label="Category filter"
              className="h-10 appearance-none rounded-md border border-zinc-200 bg-white pl-3 pr-8 text-sm outline-none transition-colors focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-zinc-600"
            >
              {COURSE_CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          </div>

          <div className="ml-auto flex items-center gap-3">
            <NotificationCenter />

            <div className="relative" ref={accountMenuRef}>
              <button
                type="button"
                aria-label="Account"
                aria-expanded={accountMenuOpen}
                aria-haspopup="menu"
                onClick={() => setAccountMenuOpen((prev) => !prev)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-zinc-600 transition-colors hover:bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                <User className="h-5 w-5" />
              </button>

              {accountMenuOpen && (
                <div
                  role="menu"
                  aria-label="Account menu"
                  className="absolute right-0 top-full mt-2 w-48 rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900 z-50"
                >
                  <Link
                    href="/profile"
                    role="menuitem"
                    onClick={() => setAccountMenuOpen(false)}
                    className="block px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Profile
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleSignOut}
                    className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-zinc-100 dark:text-red-400 dark:hover:bg-zinc-800"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
