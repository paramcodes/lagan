import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import {
  type CourseDraftData,
  getCourseDraft,
  getLessonDraft,
  getModuleDraft,
  saveCourseDraft,
  type StorageInterface,
} from "./draft-storage";
import type { BuilderModule } from "./query";
import {
  type UpdateLessonServerAction,
  type UpdateModuleServerAction,
  useCourseAutosave,
} from "./use-course-autosave";

function createTestStorage(): StorageInterface {
  const store = new Map<string, string>();
  return {
    getItem: (name: string) => store.get(name) ?? null,
    setItem: (name: string, value: string) => {
      store.set(name, value);
    },
    removeItem: (name: string) => {
      store.delete(name);
    },
  };
}

const mockModules: BuilderModule[] = [
  {
    id: "mod_1",
    courseId: "course_1",
    title: "Original Module 1",
    position: 0,
    lessons: [
      {
        id: "les_1",
        moduleId: "mod_1",
        type: "video",
        title: "Original Lesson 1",
        position: 0,
        status: "draft",
        muxPlaybackId: null,
        externalUrl: null,
        fileKey: null,
        updatedAt: new Date(),
      },
    ],
  },
];

describe("useCourseAutosave", () => {
  let storage: StorageInterface;
  let onServerUpdateModule: Mock<UpdateModuleServerAction>;
  let onServerUpdateLesson: Mock<UpdateLessonServerAction>;

  beforeEach(() => {
    vi.useFakeTimers();
    storage = createTestStorage();
    onServerUpdateModule = vi.fn<UpdateModuleServerAction>().mockResolvedValue({
      id: "mod_1",
      title: "Updated Module 1",
    });
    onServerUpdateLesson = vi.fn<UpdateLessonServerAction>().mockResolvedValue({
      id: "les_1",
      title: "Updated Lesson 1",
      type: "text",
      status: "published",
    });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("debounce", () => {
    it("debounces module title edits and persists to IndexedDB draft store", async () => {
      const { result } = renderHook(() =>
        useCourseAutosave({
          courseId: "course_1",
          initialModules: mockModules,
          debounceMs: 500,
          storage,
          onServerUpdateModule,
          onServerUpdateLesson,
        }),
      );

      // Initial state is Saved
      expect(result.current.saveState).toBe("Saved");

      // Edit module title
      act(() => {
        result.current.onDraftModuleTitle("mod_1", "Draft Module Title 1");
      });

      // Optimistic state update in memory
      expect(result.current.modules[0]?.title).toBe("Draft Module Title 1");
      expect(result.current.saveState).toBe("Offline / Unsaved draft");

      // Before debounce time: not yet persisted to storage
      expect(await getModuleDraft("mod_1", storage)).toBeNull();

      // Fast-forward past debounce time
      await act(async () => {
        vi.advanceTimersByTime(550);
      });

      // Now persisted to storage keyed by module and course
      const moduleDraft = await getModuleDraft("mod_1", storage);
      expect(moduleDraft).not.toBeNull();
      expect(moduleDraft?.title).toBe("Draft Module Title 1");

      const courseDraft = await getCourseDraft("course_1", storage);
      expect(courseDraft).not.toBeNull();
      expect(courseDraft?.pendingModules.mod_1?.title).toBe("Draft Module Title 1");
    });

    it("resets debounce timer on subsequent keystrokes", async () => {
      const { result } = renderHook(() =>
        useCourseAutosave({
          courseId: "course_1",
          initialModules: mockModules,
          debounceMs: 500,
          storage,
          onServerUpdateModule,
          onServerUpdateLesson,
        }),
      );

      act(() => {
        result.current.onDraftModuleTitle("mod_1", "Draft A");
      });

      // Advance partially
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Second keystroke
      act(() => {
        result.current.onDraftModuleTitle("mod_1", "Draft AB");
      });

      // Advance by another 300ms (total 600ms from start, but only 300ms from 2nd keystroke)
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(await getModuleDraft("mod_1", storage)).toBeNull();

      // Advance remaining 250ms
      await act(async () => {
        vi.advanceTimersByTime(250);
      });

      const moduleDraft = await getModuleDraft("mod_1", storage);
      expect(moduleDraft?.title).toBe("Draft AB");
    });

    it("debounces lesson edits and persists to IndexedDB draft store", async () => {
      const { result } = renderHook(() =>
        useCourseAutosave({
          courseId: "course_1",
          initialModules: mockModules,
          debounceMs: 500,
          storage,
          onServerUpdateModule,
          onServerUpdateLesson,
        }),
      );

      act(() => {
        result.current.onDraftLesson("les_1", {
          title: "Draft Lesson Title",
          type: "text",
          status: "published",
        });
      });

      expect(result.current.modules[0]?.lessons[0]?.title).toBe("Draft Lesson Title");
      expect(result.current.modules[0]?.lessons[0]?.type).toBe("text");
      expect(result.current.saveState).toBe("Offline / Unsaved draft");

      await act(async () => {
        vi.advanceTimersByTime(550);
      });

      const lessonDraft = await getLessonDraft("les_1", storage);
      expect(lessonDraft).not.toBeNull();
      expect(lessonDraft?.title).toBe("Draft Lesson Title");
      expect(lessonDraft?.type).toBe("text");
      expect(lessonDraft?.status).toBe("published");
    });
  });

  describe("hydration", () => {
    it("hydrates unsaved local draft over server state on mount", async () => {
      // Seed storage with an existing unsaved draft
      const draftData: CourseDraftData = {
        courseId: "course_1",
        modules: mockModules,
        pendingModules: {
          mod_1: {
            moduleId: "mod_1",
            courseId: "course_1",
            title: "Restored Module Name",
            updatedAt: new Date().toISOString(),
          },
        },
        pendingLessons: {
          les_1: {
            lessonId: "les_1",
            moduleId: "mod_1",
            courseId: "course_1",
            title: "Restored Lesson Name",
            type: "quiz",
            status: "published",
            updatedAt: new Date().toISOString(),
          },
        },
        updatedAt: new Date().toISOString(),
      };
      await saveCourseDraft(draftData, storage);

      const { result } = renderHook(() =>
        useCourseAutosave({
          courseId: "course_1",
          initialModules: mockModules,
          storage,
          onServerUpdateModule,
          onServerUpdateLesson,
        }),
      );

      // Await hydration effect
      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.hasRestoredDraft).toBe(true);
      expect(result.current.saveState).toBe("Offline / Unsaved draft");
      expect(result.current.modules[0]?.title).toBe("Restored Module Name");
      expect(result.current.modules[0]?.lessons[0]?.title).toBe("Restored Lesson Name");
      expect(result.current.modules[0]?.lessons[0]?.type).toBe("quiz");
    });

    it("does not restore draft if storage is empty", async () => {
      const { result } = renderHook(() =>
        useCourseAutosave({
          courseId: "course_1",
          initialModules: mockModules,
          storage,
          onServerUpdateModule,
          onServerUpdateLesson,
        }),
      );

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.hasRestoredDraft).toBe(false);
      expect(result.current.saveState).toBe("Saved");
      expect(result.current.modules[0]?.title).toBe("Original Module 1");
    });
  });

  describe("flush and clear", () => {
    it("flushes module to server on blur and clears local draft on success", async () => {
      const { result } = renderHook(() =>
        useCourseAutosave({
          courseId: "course_1",
          initialModules: mockModules,
          debounceMs: 500,
          storage,
          onServerUpdateModule,
          onServerUpdateLesson,
        }),
      );

      act(() => {
        result.current.onDraftModuleTitle("mod_1", "Module via Blur");
      });

      // Flush module (e.g. on blur)
      let success = false;
      await act(async () => {
        success = await result.current.flushModule("mod_1", "Module via Blur");
      });

      expect(success).toBe(true);
      expect(onServerUpdateModule).toHaveBeenCalledWith({
        id: "mod_1",
        title: "Module via Blur",
      });

      // Confirmed server response clears local draft
      expect(await getModuleDraft("mod_1", storage)).toBeNull();
      expect(await getCourseDraft("course_1", storage)).toBeNull();
      expect(result.current.saveState).toBe("Saved");
    });

    it("retains local draft if server flush fails", async () => {
      onServerUpdateModule.mockRejectedValueOnce(new Error("Network connection error"));

      const { result } = renderHook(() =>
        useCourseAutosave({
          courseId: "course_1",
          initialModules: mockModules,
          debounceMs: 500,
          storage,
          onServerUpdateModule,
          onServerUpdateLesson,
        }),
      );

      act(() => {
        result.current.onDraftModuleTitle("mod_1", "Failing Module Title");
      });

      // Let debounce persist to storage
      await act(async () => {
        vi.advanceTimersByTime(550);
      });

      let success = true;
      await act(async () => {
        success = await result.current.flushModule("mod_1");
      });

      expect(success).toBe(false);
      // Draft must NOT be cleared on failure
      const draft = await getModuleDraft("mod_1", storage);
      expect(draft).not.toBeNull();
      expect(draft?.title).toBe("Failing Module Title");
      expect(result.current.saveState).toBe("Offline / Unsaved draft");
    });

    it("flushes all pending edits on explicit Save button click", async () => {
      const { result } = renderHook(() =>
        useCourseAutosave({
          courseId: "course_1",
          initialModules: mockModules,
          debounceMs: 500,
          storage,
          onServerUpdateModule,
          onServerUpdateLesson,
        }),
      );

      act(() => {
        result.current.onDraftModuleTitle("mod_1", "New Mod");
        result.current.onDraftLesson("les_1", {
          title: "New Les",
          type: "text",
          status: "published",
        });
      });

      let ok = false;
      await act(async () => {
        ok = await result.current.flushAll();
      });

      expect(ok).toBe(true);
      expect(onServerUpdateModule).toHaveBeenCalledWith({ id: "mod_1", title: "New Mod" });
      expect(onServerUpdateLesson).toHaveBeenCalledWith({
        id: "les_1",
        title: "New Les",
        type: "text",
        status: "published",
      });

      expect(await getModuleDraft("mod_1", storage)).toBeNull();
      expect(await getLessonDraft("les_1", storage)).toBeNull();
      expect(await getCourseDraft("course_1", storage)).toBeNull();
      expect(result.current.saveState).toBe("Saved");
    });

    it("discards restored draft and reverts to server state", async () => {
      const draftData: CourseDraftData = {
        courseId: "course_1",
        modules: mockModules,
        pendingModules: {
          mod_1: {
            moduleId: "mod_1",
            courseId: "course_1",
            title: "Draft to Discard",
            updatedAt: new Date().toISOString(),
          },
        },
        pendingLessons: {},
        updatedAt: new Date().toISOString(),
      };
      await saveCourseDraft(draftData, storage);

      const { result } = renderHook(() =>
        useCourseAutosave({
          courseId: "course_1",
          initialModules: mockModules,
          storage,
          onServerUpdateModule,
          onServerUpdateLesson,
        }),
      );

      await act(async () => {
        await Promise.resolve();
      });
      expect(result.current.modules[0]?.title).toBe("Draft to Discard");
      expect(result.current.hasRestoredDraft).toBe(true);

      // Discard draft
      await act(async () => {
        await result.current.discardDraft();
      });

      expect(result.current.modules[0]?.title).toBe("Original Module 1");
      expect(result.current.hasRestoredDraft).toBe(false);
      expect(result.current.saveState).toBe("Saved");
      expect(await getCourseDraft("course_1", storage)).toBeNull();
    });
  });

  describe("offline and reconnect", () => {
    it("handles offline state and flushes on reconnect", async () => {
      const { result } = renderHook(() =>
        useCourseAutosave({
          courseId: "course_1",
          initialModules: mockModules,
          debounceMs: 500,
          storage,
          onServerUpdateModule,
          onServerUpdateLesson,
        }),
      );

      // Simulate offline event
      act(() => {
        window.dispatchEvent(new Event("offline"));
      });

      act(() => {
        result.current.onDraftModuleTitle("mod_1", "Offline Module Edit");
      });

      expect(result.current.saveState).toBe("Offline / Unsaved draft");

      // Advance debounce to write to storage
      await act(async () => {
        vi.advanceTimersByTime(550);
      });
      expect((await getModuleDraft("mod_1", storage))?.title).toBe("Offline Module Edit");

      // Simulate online reconnect event
      await act(async () => {
        window.dispatchEvent(new Event("online"));
      });

      // Automatically flushed to server on reconnect
      expect(onServerUpdateModule).toHaveBeenCalledWith({
        id: "mod_1",
        title: "Offline Module Edit",
      });
      expect(await getModuleDraft("mod_1", storage)).toBeNull();
      expect(result.current.saveState).toBe("Saved");
    });
  });
});
