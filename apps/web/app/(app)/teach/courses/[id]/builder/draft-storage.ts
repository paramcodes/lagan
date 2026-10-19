import type { LessonStatus, LessonType } from "@lagan/db";
import { createDraftStorage } from "@lagan/ui";
import type { BuilderModule } from "./query";

export interface StorageInterface {
  getItem: (name: string) => Promise<string | null> | string | null;
  setItem: (name: string, value: string) => unknown;
  removeItem: (name: string) => unknown;
}

export interface ModuleDraftData {
  moduleId: string;
  courseId: string;
  title: string;
  updatedAt: string;
}

export interface LessonDraftData {
  lessonId: string;
  moduleId: string;
  courseId: string;
  title: string;
  type: LessonType;
  status: LessonStatus;
  updatedAt: string;
}

export interface CourseDraftData {
  courseId: string;
  modules: BuilderModule[];
  pendingModules: Record<string, ModuleDraftData>;
  pendingLessons: Record<string, LessonDraftData>;
  updatedAt: string;
}

export function courseDraftKey(courseId: string): string {
  return `course:${courseId}`;
}

export function moduleDraftKey(moduleId: string): string {
  return `module:${moduleId}`;
}

export function lessonDraftKey(lessonId: string): string {
  return `lesson:${lessonId}`;
}

let defaultStorage: StorageInterface | null = null;

export function getDefaultStorage(): StorageInterface {
  if (!defaultStorage) {
    defaultStorage = createDraftStorage();
  }
  return defaultStorage as StorageInterface;
}

export function setDefaultStorage(storage: StorageInterface | null): void {
  defaultStorage = storage;
}

export async function getCourseDraft(
  courseId: string,
  storage: StorageInterface = getDefaultStorage(),
): Promise<CourseDraftData | null> {
  try {
    const raw = await storage.getItem(courseDraftKey(courseId));
    if (!raw) return null;
    return JSON.parse(raw) as CourseDraftData;
  } catch (err) {
    console.error("[lagan/builder] Failed to read course draft", err);
    return null;
  }
}

export async function saveCourseDraft(
  draft: CourseDraftData,
  storage: StorageInterface = getDefaultStorage(),
): Promise<void> {
  try {
    await storage.setItem(courseDraftKey(draft.courseId), JSON.stringify(draft));
  } catch (err) {
    console.error("[lagan/builder] Failed to save course draft", err);
  }
}

export async function getModuleDraft(
  moduleId: string,
  storage: StorageInterface = getDefaultStorage(),
): Promise<ModuleDraftData | null> {
  try {
    const raw = await storage.getItem(moduleDraftKey(moduleId));
    if (!raw) return null;
    return JSON.parse(raw) as ModuleDraftData;
  } catch {
    return null;
  }
}

export async function saveModuleDraft(
  data: ModuleDraftData,
  storage: StorageInterface = getDefaultStorage(),
): Promise<void> {
  try {
    await storage.setItem(moduleDraftKey(data.moduleId), JSON.stringify(data));
    const courseDraft = (await getCourseDraft(data.courseId, storage)) ?? {
      courseId: data.courseId,
      modules: [],
      pendingModules: {},
      pendingLessons: {},
      updatedAt: data.updatedAt,
    };
    courseDraft.pendingModules[data.moduleId] = data;
    courseDraft.modules = courseDraft.modules.map((mod) =>
      mod.id === data.moduleId ? { ...mod, title: data.title } : mod,
    );
    courseDraft.updatedAt = data.updatedAt;
    await storage.setItem(courseDraftKey(data.courseId), JSON.stringify(courseDraft));
  } catch (err) {
    console.error("[lagan/builder] Failed to save module draft", err);
  }
}

export async function clearModuleDraft(
  moduleId: string,
  courseId: string,
  storage: StorageInterface = getDefaultStorage(),
): Promise<void> {
  try {
    await storage.removeItem(moduleDraftKey(moduleId));
    const courseDraft = await getCourseDraft(courseId, storage);
    if (!courseDraft) return;

    delete courseDraft.pendingModules[moduleId];
    const hasPendingModules = Object.keys(courseDraft.pendingModules).length > 0;
    const hasPendingLessons = Object.keys(courseDraft.pendingLessons).length > 0;

    if (!hasPendingModules && !hasPendingLessons) {
      await storage.removeItem(courseDraftKey(courseId));
    } else {
      await storage.setItem(courseDraftKey(courseId), JSON.stringify(courseDraft));
    }
  } catch (err) {
    console.error("[lagan/builder] Failed to clear module draft", err);
  }
}

export async function getLessonDraft(
  lessonId: string,
  storage: StorageInterface = getDefaultStorage(),
): Promise<LessonDraftData | null> {
  try {
    const raw = await storage.getItem(lessonDraftKey(lessonId));
    if (!raw) return null;
    return JSON.parse(raw) as LessonDraftData;
  } catch {
    return null;
  }
}

export async function saveLessonDraft(
  data: LessonDraftData,
  storage: StorageInterface = getDefaultStorage(),
): Promise<void> {
  try {
    await storage.setItem(lessonDraftKey(data.lessonId), JSON.stringify(data));
    const courseDraft = (await getCourseDraft(data.courseId, storage)) ?? {
      courseId: data.courseId,
      modules: [],
      pendingModules: {},
      pendingLessons: {},
      updatedAt: data.updatedAt,
    };
    courseDraft.pendingLessons[data.lessonId] = data;
    courseDraft.modules = courseDraft.modules.map((mod) => {
      if (mod.id !== data.moduleId) return mod;
      return {
        ...mod,
        lessons: mod.lessons.map((les) =>
          les.id === data.lessonId
            ? { ...les, title: data.title, type: data.type, status: data.status }
            : les,
        ),
      };
    });
    courseDraft.updatedAt = data.updatedAt;
    await storage.setItem(courseDraftKey(data.courseId), JSON.stringify(courseDraft));
  } catch (err) {
    console.error("[lagan/builder] Failed to save lesson draft", err);
  }
}

export async function clearLessonDraft(
  lessonId: string,
  courseId: string,
  storage: StorageInterface = getDefaultStorage(),
): Promise<void> {
  try {
    await storage.removeItem(lessonDraftKey(lessonId));
    const courseDraft = await getCourseDraft(courseId, storage);
    if (!courseDraft) return;

    delete courseDraft.pendingLessons[lessonId];
    const hasPendingModules = Object.keys(courseDraft.pendingModules).length > 0;
    const hasPendingLessons = Object.keys(courseDraft.pendingLessons).length > 0;

    if (!hasPendingModules && !hasPendingLessons) {
      await storage.removeItem(courseDraftKey(courseId));
    } else {
      await storage.setItem(courseDraftKey(courseId), JSON.stringify(courseDraft));
    }
  } catch (err) {
    console.error("[lagan/builder] Failed to clear lesson draft", err);
  }
}

export async function clearCourseDraft(
  courseId: string,
  storage: StorageInterface = getDefaultStorage(),
): Promise<void> {
  try {
    const courseDraft = await getCourseDraft(courseId, storage);
    if (courseDraft) {
      for (const modId of Object.keys(courseDraft.pendingModules)) {
        await storage.removeItem(moduleDraftKey(modId));
      }
      for (const lesId of Object.keys(courseDraft.pendingLessons)) {
        await storage.removeItem(lessonDraftKey(lesId));
      }
    }
    await storage.removeItem(courseDraftKey(courseId));
  } catch (err) {
    console.error("[lagan/builder] Failed to clear course draft", err);
  }
}
