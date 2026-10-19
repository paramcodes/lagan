"use client";

import type { LessonStatus, LessonType } from "@lagan/db";
import { useDraftStore } from "@lagan/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { updateLesson, updateModule } from "../../builder/actions";
import {
  clearCourseDraft,
  clearLessonDraft,
  clearModuleDraft,
  getDefaultStorage,
  getCourseDraft,
  type LessonDraftData,
  type ModuleDraftData,
  saveLessonDraft,
  saveModuleDraft,
  type StorageInterface,
} from "./draft-storage";
import type { BuilderModule } from "./query";

export type SaveState = "Saved" | "Saving..." | "Offline / Unsaved draft";
export type TimerHandle = NodeJS.Timeout | number;
export type UpdateModuleServerAction = (input: { id: string; title: string }) => Promise<unknown>;

export type UpdateLessonServerAction = (input: {
  id: string;
  title: string;
  type: LessonType;
  status: LessonStatus;
}) => Promise<unknown>;

export interface UseCourseAutosaveOptions {
  courseId: string;
  initialModules: BuilderModule[];
  debounceMs?: number | undefined;
  storage?: StorageInterface | undefined;
  onServerUpdateModule?: UpdateModuleServerAction | undefined;
  onServerUpdateLesson?: UpdateLessonServerAction | undefined;
}

export function useCourseAutosave({
  courseId,
  initialModules,
  debounceMs = 800,
  storage = getDefaultStorage(),
  onServerUpdateModule = updateModule,
  onServerUpdateLesson = updateLesson,
}: UseCourseAutosaveOptions) {
  const [modules, setModules] = useState<BuilderModule[]>(initialModules);
  const [saveState, setSaveState] = useState<SaveState>("Saved");
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== "undefined" && typeof navigator.onLine === "boolean"
      ? navigator.onLine
      : true;
  });

  const pendingModulesRef = useRef<Map<string, ModuleDraftData>>(new Map());
  const pendingLessonsRef = useRef<Map<string, LessonDraftData>>(new Map());
  const debounceTimersRef = useRef<Map<string, TimerHandle>>(new Map());
  const initialModulesRef = useRef<BuilderModule[]>(initialModules);
  initialModulesRef.current = initialModules;

  // Hydrate unsaved drafts on mount
  useEffect(() => {
    let isCancelled = false;

    async function hydrateDraft() {
      const draft = await getCourseDraft(courseId, storage);
      if (isCancelled || !draft) return;

      const pendingModuleCount = Object.keys(draft.pendingModules).length;
      const pendingLessonCount = Object.keys(draft.pendingLessons).length;

      if (pendingModuleCount === 0 && pendingLessonCount === 0) return;

      // Seed pending references
      for (const [id, modData] of Object.entries(draft.pendingModules)) {
        pendingModulesRef.current.set(id, modData);
      }
      for (const [id, lesData] of Object.entries(draft.pendingLessons)) {
        pendingLessonsRef.current.set(id, lesData);
      }

      // Hydrate local modules state over initial server modules
      setModules((currentModules) => {
        return currentModules.map((mod) => {
          const modDraft = draft.pendingModules[mod.id];
          const updatedTitle = modDraft ? modDraft.title : mod.title;
          const updatedLessons = mod.lessons.map((les) => {
            const lesDraft = draft.pendingLessons[les.id];
            if (!lesDraft) return les;
            return {
              ...les,
              title: lesDraft.title,
              type: lesDraft.type,
              status: lesDraft.status,
            };
          });
          return {
            ...mod,
            title: updatedTitle,
            lessons: updatedLessons,
          };
        });
      });

      setHasRestoredDraft(true);
      setSaveState("Offline / Unsaved draft");
    }

    void hydrateDraft();

    return () => {
      isCancelled = true;
    };
  }, [courseId, storage]);

  // Debounced draft edit for module title
  const onDraftModuleTitle = useCallback(
    (moduleId: string, title: string) => {
      // 1. Update UI state optimistically
      setModules((prev) => prev.map((mod) => (mod.id === moduleId ? { ...mod, title } : mod)));

      const now = new Date().toISOString();
      const draftData: ModuleDraftData = {
        moduleId,
        courseId,
        title,
        updatedAt: now,
      };
      pendingModulesRef.current.set(moduleId, draftData);
      setSaveState("Offline / Unsaved draft");

      // 2. Debounce persist to IndexedDB
      const existingTimer = debounceTimersRef.current.get(`mod:${moduleId}`);
      clearTimeout(existingTimer);

      const timer = setTimeout(() => {
        debounceTimersRef.current.delete(`mod:${moduleId}`);
        void saveModuleDraft(draftData, storage);
        useDraftStore.getState().updateModule(courseId, moduleId, { title });
      }, debounceMs);

      debounceTimersRef.current.set(`mod:${moduleId}`, timer);
    },
    [courseId, debounceMs, storage],
  );

  // Debounced draft edit for lesson
  const onDraftLesson = useCallback(
    (lessonId: string, data: { title: string; type: LessonType; status: LessonStatus }) => {
      // 1. Update UI state optimistically
      let targetModuleId = "";
      setModules((prev) =>
        prev.map((mod) => {
          const hasLesson = mod.lessons.some((l) => l.id === lessonId);
          if (!hasLesson) return mod;
          targetModuleId = mod.id;
          return {
            ...mod,
            lessons: mod.lessons.map((les) =>
              les.id === lessonId
                ? { ...les, title: data.title, type: data.type, status: data.status }
                : les,
            ),
          };
        }),
      );

      const now = new Date().toISOString();
      const draftData: LessonDraftData = {
        lessonId,
        moduleId: targetModuleId,
        courseId,
        title: data.title,
        type: data.type,
        status: data.status,
        updatedAt: now,
      };
      pendingLessonsRef.current.set(lessonId, draftData);
      setSaveState("Offline / Unsaved draft");

      // 2. Debounce persist to IndexedDB
      const existingTimer = debounceTimersRef.current.get(`les:${lessonId}`);
      clearTimeout(existingTimer);

      const timer = setTimeout(() => {
        debounceTimersRef.current.delete(`les:${lessonId}`);
        void saveLessonDraft(draftData, storage);
        if (targetModuleId) {
          useDraftStore.getState().updateLesson(courseId, targetModuleId, lessonId, {
            title: data.title,
            type: data.type,
          });
        }
      }, debounceMs);

      debounceTimersRef.current.set(`les:${lessonId}`, timer);
    },
    [courseId, debounceMs, storage],
  );

  // Flush single module to server
  const flushModule = useCallback(
    async (moduleId: string, explicitTitle?: string): Promise<boolean> => {
      const timer = debounceTimersRef.current.get(`mod:${moduleId}`);
      clearTimeout(timer);
      debounceTimersRef.current.delete(`mod:${moduleId}`);

      const pending = pendingModulesRef.current.get(moduleId);
      const titleToSave = explicitTitle ?? pending?.title;

      if (!titleToSave) return true;

      // If offline, ensure saved locally in IndexedDB and leave pending
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await saveModuleDraft(
          {
            moduleId,
            courseId,
            title: titleToSave,
            updatedAt: new Date().toISOString(),
          },
          storage,
        );
        setSaveState("Offline / Unsaved draft");
        return false;
      }

      setSaveState("Saving...");
      try {
        await onServerUpdateModule({ id: moduleId, title: titleToSave });
        // Confirmed server response: clear local draft
        await clearModuleDraft(moduleId, courseId, storage);
        pendingModulesRef.current.delete(moduleId);

        const hasRemainingPending =
          pendingModulesRef.current.size > 0 || pendingLessonsRef.current.size > 0;
        setSaveState(hasRemainingPending ? "Offline / Unsaved draft" : "Saved");
        if (!hasRemainingPending) {
          setHasRestoredDraft(false);
        }
        return true;
      } catch (err) {
        console.error("[lagan/builder] Failed to flush module", err);
        setSaveState("Offline / Unsaved draft");
        return false;
      }
    },
    [courseId, onServerUpdateModule, storage],
  );

  // Flush single lesson to server
  const flushLesson = useCallback(
    async (
      lessonId: string,
      explicitData?: { title: string; type: LessonType; status: LessonStatus },
    ): Promise<boolean> => {
      const timer = debounceTimersRef.current.get(`les:${lessonId}`);
      clearTimeout(timer);
      debounceTimersRef.current.delete(`les:${lessonId}`);

      const pending = pendingLessonsRef.current.get(lessonId);
      const dataToSave = explicitData ?? pending;

      if (!dataToSave) return true;

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await saveLessonDraft(
          {
            lessonId,
            moduleId: pending?.moduleId ?? "",
            courseId,
            title: dataToSave.title,
            type: dataToSave.type,
            status: dataToSave.status,
            updatedAt: new Date().toISOString(),
          },
          storage,
        );
        setSaveState("Offline / Unsaved draft");
        return false;
      }

      setSaveState("Saving...");
      try {
        await onServerUpdateLesson({
          id: lessonId,
          title: dataToSave.title,
          type: dataToSave.type,
          status: dataToSave.status,
        });
        // Confirmed server response: clear local draft
        await clearLessonDraft(lessonId, courseId, storage);
        pendingLessonsRef.current.delete(lessonId);

        const hasRemainingPending =
          pendingModulesRef.current.size > 0 || pendingLessonsRef.current.size > 0;
        setSaveState(hasRemainingPending ? "Offline / Unsaved draft" : "Saved");
        if (!hasRemainingPending) {
          setHasRestoredDraft(false);
        }
        return true;
      } catch (err) {
        console.error("[lagan/builder] Failed to flush lesson", err);
        setSaveState("Offline / Unsaved draft");
        return false;
      }
    },
    [courseId, onServerUpdateLesson, storage],
  );

  // Flush all pending edits to server (explicit Save button click)
  const flushAll = useCallback(async (): Promise<boolean> => {
    // Clear all pending debounce timers
    for (const [key, timer] of debounceTimersRef.current.entries()) {
      clearTimeout(timer);
      debounceTimersRef.current.delete(key);
    }

    const pendingModules = Array.from(pendingModulesRef.current.values());
    const pendingLessons = Array.from(pendingLessonsRef.current.values());

    if (pendingModules.length === 0 && pendingLessons.length === 0) {
      setSaveState("Saved");
      setHasRestoredDraft(false);
      return true;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setSaveState("Offline / Unsaved draft");
      return false;
    }

    setSaveState("Saving...");
    let allSucceeded = true;

    // Flush all pending modules
    for (const mod of pendingModules) {
      try {
        await onServerUpdateModule({ id: mod.moduleId, title: mod.title });
        await clearModuleDraft(mod.moduleId, courseId, storage);
        pendingModulesRef.current.delete(mod.moduleId);
      } catch {
        allSucceeded = false;
      }
    }

    // Flush all pending lessons
    for (const les of pendingLessons) {
      try {
        await onServerUpdateLesson({
          id: les.lessonId,
          title: les.title,
          type: les.type,
          status: les.status,
        });
        await clearLessonDraft(les.lessonId, courseId, storage);
        pendingLessonsRef.current.delete(les.lessonId);
      } catch {
        allSucceeded = false;
      }
    }

    if (allSucceeded) {
      await clearCourseDraft(courseId, storage);
      useDraftStore.getState().removeDraft(courseId);
      setHasRestoredDraft(false);
      setSaveState("Saved");
      return true;
    }

    setSaveState("Offline / Unsaved draft");
    return false;
  }, [courseId, onServerUpdateLesson, onServerUpdateModule, storage]);

  // Discard local restored draft and revert to server state
  const discardDraft = useCallback(async () => {
    for (const [, timer] of debounceTimersRef.current.entries()) {
      clearTimeout(timer);
    }
    debounceTimersRef.current.clear();
    pendingModulesRef.current.clear();
    pendingLessonsRef.current.clear();

    await clearCourseDraft(courseId, storage);
    useDraftStore.getState().removeDraft(courseId);

    setModules(initialModulesRef.current);
    setHasRestoredDraft(false);
    setSaveState("Saved");
  }, [courseId, storage]);

  // Offline / reconnect handling
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (pendingModulesRef.current.size > 0 || pendingLessonsRef.current.size > 0) {
        void flushAll();
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
      if (pendingModulesRef.current.size > 0 || pendingLessonsRef.current.size > 0) {
        setSaveState("Offline / Unsaved draft");
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [flushAll]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      for (const [, timer] of debounceTimersRef.current.entries()) {
        clearTimeout(timer);
      }
      debounceTimersRef.current.clear();
    };
  }, []);

  const hasUnsavedChanges =
    pendingModulesRef.current.size > 0 || pendingLessonsRef.current.size > 0;

  return {
    modules,
    setModules,
    saveState,
    hasRestoredDraft,
    hasUnsavedChanges,
    onDraftModuleTitle,
    onDraftLesson,
    flushModule,
    flushLesson,
    flushAll,
    discardDraft,
    isOnline,
  };
}
