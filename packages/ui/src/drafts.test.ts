import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StateStorage } from "zustand/middleware";
import {
  type CourseDraft,
  createDraftStorage,
  createDraftStore,
  createMemoryStorage,
  type DraftStore,
  type DraftStoreState,
  selectDraft,
  selectDraftList,
} from "./drafts";

const PERSIST_KEY = "test:drafts";

async function readPersisted(
  storage: StateStorage,
  name = PERSIST_KEY,
): Promise<{ state: Partial<DraftStoreState>; version?: number } | null> {
  const raw = await storage.getItem(name);
  return raw === null ? null : JSON.parse(raw);
}

async function readPersistedDraft(
  draftId: string,
  storage: StateStorage,
  name = PERSIST_KEY,
): Promise<CourseDraft | undefined> {
  const persisted = await readPersisted(storage, name);
  return persisted?.state.drafts?.[draftId];
}

describe("draft store", () => {
  let storage: StateStorage;
  let store: DraftStore;
  let state: DraftStoreState;

  beforeEach(() => {
    storage = createMemoryStorage();
    store = createDraftStore({ name: PERSIST_KEY, storage });
    state = store.getState();
  });

  it("creates a draft and makes it active", () => {
    const draftId = state.createDraft({ title: "Intro to Rust" });

    expect(store.getState().activeDraftId).toBe(draftId);
    expect(store.getState().drafts[draftId]?.title).toBe("Intro to Rust");
  });

  it("persists drafts, modules and lessons to the backing storage", async () => {
    const draftId = state.createDraft({ title: "Intro to Rust", priceCents: 4900 });
    const moduleId = store.getState().addModule(draftId, { title: "Getting started" });
    const lessonId = store
      .getState()
      .addLesson(draftId, moduleId as string, { type: "text", title: "Install" });

    const persisted = await readPersisted(storage);

    expect(persisted?.version).toBe(1);
    const draft = await readPersistedDraft(draftId, storage);
    expect(draft?.priceCents).toBe(4900);
    expect(draft?.modules[0]?.title).toBe("Getting started");
    expect(draft?.modules[0]?.lessons[0]?.id).toBe(lessonId);
    expect(persisted?.state.activeDraftId).toBe(draftId);
  });

  it("orders modules and lessons by the authored index", () => {
    const draftId = state.createDraft();
    const first = store.getState().addModule(draftId, { title: "First" }) as string;
    const second = store.getState().addModule(draftId, { title: "Second" }) as string;
    const third = store.getState().addModule(draftId, { title: "Third" }) as string;

    store.getState().moveModule(draftId, third, 0);
    expect(store.getState().drafts[draftId]?.modules.map((m) => m.id)).toEqual([
      third,
      first,
      second,
    ]);

    const lessonA = store.getState().addLesson(draftId, first, { title: "A" }) as string;
    const lessonB = store.getState().addLesson(draftId, first, { title: "B" }) as string;
    const lessonC = store.getState().addLesson(draftId, first, { title: "C" }) as string;

    store.getState().moveLesson(draftId, first, lessonB, 2);

    const firstModule = store.getState().drafts[draftId]?.modules[1];
    expect(firstModule?.lessons.map((l) => l.id)).toEqual([lessonA, lessonC, lessonB]);
  });

  it("clamps an out-of-range move instead of losing the item", () => {
    const draftId = state.createDraft();
    const only = store.getState().addModule(draftId, { title: "Only" }) as string;

    store.getState().moveModule(draftId, only, 42);

    expect(store.getState().drafts[draftId]?.modules.map((m) => m.id)).toEqual([only]);
  });

  it("moves a lesson into another module at a given index", () => {
    const draftId = state.createDraft();
    const moduleA = store.getState().addModule(draftId, { title: "A" }) as string;
    const moduleB = store.getState().addModule(draftId, { title: "B" }) as string;
    const moving = store.getState().addLesson(draftId, moduleA, { title: "Move me" }) as string;
    const existing = store.getState().addLesson(draftId, moduleB, { title: "Existing" }) as string;

    store.getState().moveLessonToModule(draftId, moving, moduleB, 0);

    const modules = store.getState().drafts[draftId]?.modules ?? [];
    expect(modules[0]?.lessons).toHaveLength(0);
    expect(modules[1]?.lessons.map((l) => l.id)).toEqual([moving, existing]);
  });

  it("updates only the addressed lesson", () => {
    const draftId = state.createDraft();
    const moduleId = store.getState().addModule(draftId) as string;
    const lessonA = store.getState().addLesson(draftId, moduleId, { title: "A" }) as string;
    const lessonB = store.getState().addLesson(draftId, moduleId, { title: "B" }) as string;

    store.getState().updateLesson(draftId, moduleId, lessonB, {
      title: "Renamed",
      type: "quiz",
    });

    const lessons = store.getState().drafts[draftId]?.modules[0]?.lessons ?? [];
    expect(lessons.find((l) => l.id === lessonA)?.title).toBe("A");
    expect(lessons.find((l) => l.id === lessonB)?.title).toBe("Renamed");
    expect(lessons.find((l) => l.id === lessonB)?.type).toBe("quiz");
  });

  it("refuses to add a lesson to an unknown module", () => {
    const draftId = state.createDraft();

    expect(store.getState().addLesson(draftId, "module_missing")).toBeNull();
    expect(store.getState().drafts[draftId]?.modules).toEqual([]);
  });

  it("drops a removed draft and clears it when active", () => {
    const draftId = state.createDraft({ title: "Doomed" });

    store.getState().removeDraft(draftId);

    expect(store.getState().drafts[draftId]).toBeUndefined();
    expect(store.getState().activeDraftId).toBeNull();
    expect(selectDraft(draftId)(store.getState())).toBeUndefined();
  });

  it("duplicates a draft with fresh ids", () => {
    const draftId = state.createDraft({ title: "Original" });
    const moduleId = store.getState().addModule(draftId, { title: "M" }) as string;
    store.getState().addLesson(draftId, moduleId, { title: "L" });

    const copyId = store.getState().duplicateDraft(draftId) as string;
    const copy = store.getState().drafts[copyId];

    expect(copyId).not.toBe(draftId);
    expect(copy?.title).toBe("Original");
    expect(copy?.modules[0]?.id).not.toBe(moduleId);
    expect(copy?.modules[0]?.lessons[0]?.title).toBe("L");
  });

  it("lists drafts with the most recently edited first", () => {
    const first = state.createDraft({ title: "Older" });
    const second = store.getState().createDraft({ title: "Newer" });
    const older = store.getState().drafts[first];
    if (!older) throw new Error("missing draft");
    store.setState({
      drafts: {
        ...store.getState().drafts,
        [first]: { ...older, updatedAt: "1999-01-01T00:00:00.000Z" },
      },
    });

    expect(selectDraftList(store.getState()).map((d) => d.id)).toEqual([second, first]);
  });

  it("rehydrates persisted drafts from storage", async () => {
    const draftId = state.createDraft({ title: "Survives reload" });
    expect(await readPersistedDraft(draftId, storage)).toBeDefined();

    const reloaded = createDraftStore({ name: PERSIST_KEY, storage });
    await reloaded.persist.rehydrate();

    expect(reloaded.getState().drafts[draftId]?.title).toBe("Survives reload");
    expect(reloaded.getState().hydrated).toBe(true);
  });
});

describe("draft storage", () => {
  it("round-trips values through IndexedDB", async () => {
    const storage = createDraftStorage();

    await storage.setItem("key", JSON.stringify({ value: 42 }));
    expect(await storage.getItem("key")).toBe(JSON.stringify({ value: 42 }));

    await storage.removeItem("key");
    expect(await storage.getItem("key")).toBeNull();
  });

  it("writes a draft to IndexedDB through the store", async () => {
    const name = `idb-test:${Date.now()}`;
    const storage = createDraftStorage();
    const store = createDraftStore({ name, storage });
    const draftId = store.getState().createDraft({ title: "Offline draft" });

    await vi.waitFor(async () => {
      expect(await storage.getItem(name)).toBeTruthy();
    });

    const raw = await storage.getItem(name);
    expect(raw).toContain(draftId);
    expect(raw).toContain("Offline draft");
  });
});
