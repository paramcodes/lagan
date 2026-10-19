"use client";

import { createStore as createIdbStore, del, get, set } from "idb-keyval";
import { create } from "zustand";
import type { StateStorage } from "zustand/middleware";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * Local-first draft store for the course builder.
 *
 * Authors edit a course (its fields plus an ordered tree of modules and lessons)
 * long before anything is written to Postgres. Every mutation is persisted to
 * IndexedDB through `idb-keyval`, so a reload, a crash or an offline session
 * keeps the work. The store is deliberately separate from the server: the shape
 * here mirrors `packages/db` course/module/lesson columns, and the publish step
 * (P2.10) is what maps a draft onto those rows.
 */

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

/** Mirrors the `course_status` union in the database schema. */
export type CourseDraftStatus = "draft" | "published" | "archived";

/** Mirrors the `lesson_type` union in the database schema. */
export type LessonDraftType = "video" | "text" | "quiz" | "file" | "external";

export interface LessonDraft {
  id: string;
  type: LessonDraftType;
  title: string;
  /** TiPTap document for text and quiz lessons, `null` for the other types. */
  contentJson: unknown | null;
  /** Mux playback id, uploaded by P2.3. `null` until the asset is ready. */
  muxPlaybackId: string | null;
  externalUrl: string | null;
  /** Object-storage key for file lessons. */
  fileKey: string | null;
  updatedAt: string;
}

export interface ModuleDraft {
  id: string;
  title: string;
  /** Authored order. Array index becomes the `position` column on publish. */
  lessons: LessonDraft[];
}

export interface CourseDraft {
  id: string;
  title: string;
  description: string;
  priceCents: number;
  discountPercent: number;
  isFree: boolean;
  status: CourseDraftStatus;
  version: number;
  modules: ModuleDraft[];
  createdAt: string;
  updatedAt: string;
}

/** Course fields an author edits directly. */
export type CourseDraftFields = Pick<
  CourseDraft,
  "title" | "description" | "priceCents" | "discountPercent" | "isFree" | "status"
>;

/** Lesson fields an author edits directly. */
export type LessonDraftFields = Pick<
  LessonDraft,
  "type" | "title" | "contentJson" | "muxPlaybackId" | "externalUrl" | "fileKey"
>;

export type CreateCourseDraftInput = Partial<CourseDraftFields> & {
  id?: string;
  modules?: ModuleDraft[];
};

export const emptyCourseDraftFields: CourseDraftFields = {
  title: "",
  description: "",
  priceCents: 0,
  discountPercent: 0,
  isFree: true,
  status: "draft",
};

export const emptyLessonDraftFields: LessonDraftFields = {
  type: "video",
  title: "",
  contentJson: null,
  muxPlaybackId: null,
  externalUrl: null,
  fileKey: null,
};

/* -------------------------------------------------------------------------- */
/* Factories                                                                  */
/* -------------------------------------------------------------------------- */

function randomId(prefix: string): string {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  return `${prefix}_${uuid}`;
}

export function createLessonDraft(overrides: Partial<LessonDraftFields> = {}): LessonDraft {
  return {
    id: randomId("lesson"),
    ...emptyLessonDraftFields,
    ...overrides,
    updatedAt: new Date().toISOString(),
  };
}

export function createModuleDraft(overrides: { title?: string } = {}): ModuleDraft {
  return { id: randomId("module"), title: overrides.title ?? "", lessons: [] };
}

export function createCourseDraft(input: CreateCourseDraftInput = {}): CourseDraft {
  const { id, modules, ...fields } = input;
  const now = new Date().toISOString();
  return {
    id: id ?? randomId("course"),
    ...emptyCourseDraftFields,
    ...fields,
    version: 1,
    modules: modules ?? [],
    createdAt: now,
    updatedAt: now,
  };
}

/* -------------------------------------------------------------------------- */
/* Storage                                                                    */
/* -------------------------------------------------------------------------- */

export const DRAFT_DB_NAME = "lagan-authoring";
export const DRAFT_STORE_NAME = "course-drafts";
export const DRAFT_PERSIST_KEY = "lagan:course-drafts";
export const DRAFT_STORE_VERSION = 1;

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

/**
 * In-memory `StateStorage` used on the server and whenever IndexedDB is missing
 * (private-mode browsers, tests). Keeps the store usable instead of throwing.
 */
export function createMemoryStorage(): StateStorage {
  const values = new Map<string, string>();
  return {
    getItem: (name) => values.get(name) ?? null,
    setItem: (name, value) => {
      values.set(name, value);
    },
    removeItem: (name) => {
      values.delete(name);
    },
  };
}

/** `StateStorage` backed by an IndexedDB object store, via `idb-keyval`. */
export function createDraftStorage(): StateStorage {
  if (!hasIndexedDb()) return createMemoryStorage();

  const store = createIdbStore(DRAFT_DB_NAME, DRAFT_STORE_NAME);
  return {
    getItem: async (name) => (await get<string>(name, store)) ?? null,
    setItem: async (name, value) => {
      await set(name, value, store);
    },
    removeItem: async (name) => {
      await del(name, store);
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Store                                                                      */
/* -------------------------------------------------------------------------- */

export interface DraftStoreState {
  /** Keyed by draft id, so a lookup never scans an array. */
  drafts: Record<string, CourseDraft>;
  activeDraftId: string | null;
  /** False until IndexedDB has been read back. Gate UI on this to avoid a flash. */
  hydrated: boolean;
  setHydrated: (hydrated: boolean) => void;

  createDraft: (input?: CreateCourseDraftInput) => string;
  updateDraft: (draftId: string, patch: Partial<CourseDraftFields>) => void;
  duplicateDraft: (draftId: string) => string | null;
  removeDraft: (draftId: string) => void;
  setActiveDraft: (draftId: string | null) => void;
  clearDrafts: () => void;

  addModule: (draftId: string, input?: { title?: string }) => string | null;
  updateModule: (draftId: string, moduleId: string, patch: { title?: string }) => void;
  removeModule: (draftId: string, moduleId: string) => void;
  moveModule: (draftId: string, moduleId: string, toIndex: number) => void;

  addLesson: (
    draftId: string,
    moduleId: string,
    input?: Partial<LessonDraftFields>,
  ) => string | null;
  updateLesson: (
    draftId: string,
    moduleId: string,
    lessonId: string,
    patch: Partial<LessonDraftFields>,
  ) => void;
  removeLesson: (draftId: string, moduleId: string, lessonId: string) => void;
  moveLesson: (draftId: string, moduleId: string, lessonId: string, toIndex: number) => void;
  /** Move a lesson across modules, or reorder inside `toModuleId` when it matches. */
  moveLessonToModule: (
    draftId: string,
    lessonId: string,
    toModuleId: string,
    toIndex?: number,
  ) => void;
}

type PersistedDraftState = Pick<DraftStoreState, "drafts" | "activeDraftId">;

function replaceDraft(
  drafts: Record<string, CourseDraft>,
  draftId: string,
  transform: (draft: CourseDraft) => CourseDraft,
): Record<string, CourseDraft> {
  const draft = drafts[draftId];
  if (!draft) return drafts;
  return { ...drafts, [draftId]: { ...transform(draft), updatedAt: new Date().toISOString() } };
}

function replaceModule(
  draft: CourseDraft,
  moduleId: string,
  transform: (module: ModuleDraft) => ModuleDraft,
): CourseDraft {
  return {
    ...draft,
    modules: draft.modules.map((module) => (module.id === moduleId ? transform(module) : module)),
  };
}

/** Move an item, clamping the destination index to the array bounds. */
function moveItem<T>(items: readonly T[], fromIndex: number, toIndex: number): T[] {
  const next = [...items];
  if (fromIndex < 0 || fromIndex >= next.length) return next;
  const [item] = next.splice(fromIndex, 1);
  if (item === undefined) return next;
  next.splice(Math.min(Math.max(toIndex, 0), next.length), 0, item);
  return next;
}

function insertAt<T>(items: readonly T[], item: T, index: number): T[] {
  const next = [...items];
  next.splice(Math.min(Math.max(index, 0), next.length), 0, item);
  return next;
}

export interface CreateDraftStoreOptions {
  /** Persist key inside the IndexedDB store. Defaults to `DRAFT_PERSIST_KEY`. */
  name?: string;
  /** Override the backing storage. Defaults to IndexedDB, or memory when absent. */
  storage?: StateStorage;
}

export function createDraftStore(options: CreateDraftStoreOptions = {}) {
  const name = options.name ?? DRAFT_PERSIST_KEY;
  const storage = options.storage ?? createDraftStorage();

  return create<DraftStoreState>()(
    persist(
      (set, get) => ({
        drafts: {},
        activeDraftId: null,
        hydrated: false,

        setHydrated: (hydrated) => set({ hydrated }),

        createDraft: (input) => {
          const draft = createCourseDraft(input);
          set((state) => ({
            drafts: { ...state.drafts, [draft.id]: draft },
            activeDraftId: draft.id,
          }));
          return draft.id;
        },

        updateDraft: (draftId, patch) => {
          set((state) => ({
            drafts: replaceDraft(state.drafts, draftId, (d) => ({ ...d, ...patch })),
          }));
        },

        duplicateDraft: (draftId) => {
          const source = get().drafts[draftId];
          if (!source) return null;
          const copy = createCourseDraft({
            title: source.title,
            description: source.description,
            priceCents: source.priceCents,
            discountPercent: source.discountPercent,
            isFree: source.isFree,
            status: source.status,
            modules: source.modules.map((module) => ({
              ...module,
              id: randomId("module"),
              lessons: module.lessons.map((lesson) => ({ ...lesson, id: randomId("lesson") })),
            })),
          });
          set((state) => ({
            drafts: { ...state.drafts, [copy.id]: copy },
            activeDraftId: copy.id,
          }));
          return copy.id;
        },

        removeDraft: (draftId) => {
          set((state) => {
            const { [draftId]: _removed, ...drafts } = state.drafts;
            return {
              drafts,
              activeDraftId: state.activeDraftId === draftId ? null : state.activeDraftId,
            };
          });
        },

        setActiveDraft: (draftId) => {
          if (draftId !== null && !get().drafts[draftId]) return;
          set({ activeDraftId: draftId });
        },

        clearDrafts: () => set({ drafts: {}, activeDraftId: null }),

        addModule: (draftId, input) => {
          const draft = get().drafts[draftId];
          if (!draft) return null;
          const module = createModuleDraft(input);
          set((state) => ({
            drafts: replaceDraft(state.drafts, draftId, (d) => ({
              ...d,
              modules: [...d.modules, module],
            })),
          }));
          return module.id;
        },

        updateModule: (draftId, moduleId, patch) => {
          set((state) => ({
            drafts: replaceDraft(state.drafts, draftId, (d) =>
              replaceModule(d, moduleId, (module) => ({ ...module, ...patch })),
            ),
          }));
        },

        removeModule: (draftId, moduleId) => {
          set((state) => ({
            drafts: replaceDraft(state.drafts, draftId, (d) => ({
              ...d,
              modules: d.modules.filter((module) => module.id !== moduleId),
            })),
          }));
        },

        moveModule: (draftId, moduleId, toIndex) => {
          set((state) => ({
            drafts: replaceDraft(state.drafts, draftId, (d) => {
              const fromIndex = d.modules.findIndex((module) => module.id === moduleId);
              if (fromIndex === -1) return d;
              return { ...d, modules: moveItem(d.modules, fromIndex, toIndex) };
            }),
          }));
        },

        addLesson: (draftId, moduleId, input) => {
          const draft = get().drafts[draftId];
          if (!draft?.modules.some((module) => module.id === moduleId)) return null;
          const lesson = createLessonDraft(input);
          set((state) => ({
            drafts: replaceDraft(state.drafts, draftId, (d) =>
              replaceModule(d, moduleId, (module) => ({
                ...module,
                lessons: [...module.lessons, lesson],
              })),
            ),
          }));
          return lesson.id;
        },

        updateLesson: (draftId, moduleId, lessonId, patch) => {
          set((state) => ({
            drafts: replaceDraft(state.drafts, draftId, (d) =>
              replaceModule(d, moduleId, (module) => ({
                ...module,
                lessons: module.lessons.map((lesson) =>
                  lesson.id === lessonId
                    ? { ...lesson, ...patch, updatedAt: new Date().toISOString() }
                    : lesson,
                ),
              })),
            ),
          }));
        },

        removeLesson: (draftId, moduleId, lessonId) => {
          set((state) => ({
            drafts: replaceDraft(state.drafts, draftId, (d) =>
              replaceModule(d, moduleId, (module) => ({
                ...module,
                lessons: module.lessons.filter((lesson) => lesson.id !== lessonId),
              })),
            ),
          }));
        },

        moveLesson: (draftId, moduleId, lessonId, toIndex) => {
          set((state) => ({
            drafts: replaceDraft(state.drafts, draftId, (d) =>
              replaceModule(d, moduleId, (module) => {
                const fromIndex = module.lessons.findIndex((lesson) => lesson.id === lessonId);
                if (fromIndex === -1) return module;
                return { ...module, lessons: moveItem(module.lessons, fromIndex, toIndex) };
              }),
            ),
          }));
        },

        moveLessonToModule: (draftId, lessonId, toModuleId, toIndex) => {
          const draft = get().drafts[draftId];
          if (!draft) return;
          const source = draft.modules.find((module) =>
            module.lessons.some((lesson) => lesson.id === lessonId),
          );
          const target = draft.modules.find((module) => module.id === toModuleId);
          if (!source || !target) return;

          if (source.id === target.id) {
            get().moveLesson(draftId, toModuleId, lessonId, toIndex ?? target.lessons.length - 1);
            return;
          }

          const lesson = source.lessons.find((item) => item.id === lessonId);
          if (!lesson) return;

          set((state) => ({
            drafts: replaceDraft(state.drafts, draftId, (d) => ({
              ...d,
              modules: d.modules.map((module) => {
                if (module.id === source.id) {
                  return {
                    ...module,
                    lessons: module.lessons.filter((item) => item.id !== lessonId),
                  };
                }
                if (module.id === toModuleId) {
                  return {
                    ...module,
                    lessons: insertAt(module.lessons, lesson, toIndex ?? module.lessons.length),
                  };
                }
                return module;
              }),
            })),
          }));
        },
      }),
      {
        name,
        version: DRAFT_STORE_VERSION,
        storage: createJSONStorage<PersistedDraftState>(() => storage),
        partialize: (state): PersistedDraftState => ({
          drafts: state.drafts,
          activeDraftId: state.activeDraftId,
        }),
        onRehydrateStorage: () => (state, error) => {
          if (error) {
            console.error("[lagan/ui] could not rehydrate course drafts", error);
            return;
          }
          state?.setHydrated(true);
        },
      },
    ),
  );
}

export type DraftStore = ReturnType<typeof createDraftStore>;

/** App-wide draft store. Client-only; IndexedDB is absent on the server. */
export const useDraftStore = createDraftStore();

/* -------------------------------------------------------------------------- */
/* Selectors                                                                  */
/* -------------------------------------------------------------------------- */

export function selectDraft(draftId: string | null) {
  return (state: DraftStoreState): CourseDraft | undefined =>
    draftId === null ? undefined : state.drafts[draftId];
}

export function selectActiveDraft(state: DraftStoreState): CourseDraft | undefined {
  return selectDraft(state.activeDraftId)(state);
}

/** Most recently edited first, for the draft list in the builder. */
export function selectDraftList(state: DraftStoreState): CourseDraft[] {
  return Object.values(state.drafts).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
