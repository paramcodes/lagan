import { z } from "zod";

export const courseIdSchema = z.string().min(1);
export const moduleIdSchema = z.string().min(1);
export const lessonIdSchema = z.string().min(1);

export const lessonTypeSchema = z.enum(["video", "text", "quiz", "file", "external"]);
export const lessonStatusSchema = z.enum(["draft", "published"]);

const titleSchema = z.string().trim().min(1).max(200);
const orderedIdsSchema = z
  .array(z.string().min(1))
  .refine((ids) => new Set(ids).size === ids.length, "duplicate ids");

export const createModuleSchema = z
  .object({
    courseId: courseIdSchema,
    title: titleSchema,
  })
  .strict();

export const updateModuleSchema = z
  .object({
    id: moduleIdSchema,
    title: titleSchema.optional(),
  })
  .strict()
  .refine((value) => value.title !== undefined, "no module fields to update");

export const deleteModuleSchema = z
  .object({
    id: moduleIdSchema,
  })
  .strict();

export const reorderModulesSchema = z
  .object({
    courseId: courseIdSchema,
    orderedIds: orderedIdsSchema,
  })
  .strict();

export const createLessonSchema = z
  .object({
    moduleId: moduleIdSchema,
    type: lessonTypeSchema,
    title: titleSchema,
    contentJson: z.unknown().nullish(),
    muxPlaybackId: z.string().max(200).nullish(),
    externalUrl: z.string().max(2000).nullish(),
    fileKey: z.string().max(500).nullish(),
  })
  .strict();

export const updateLessonSchema = z
  .object({
    id: lessonIdSchema,
    type: lessonTypeSchema.optional(),
    title: titleSchema.optional(),
    status: lessonStatusSchema.optional(),
    contentJson: z.unknown().nullish(),
    muxPlaybackId: z.string().max(200).nullish(),
    externalUrl: z.string().max(2000).nullish(),
    fileKey: z.string().max(500).nullish(),
  })
  .strict();

export const deleteLessonSchema = z
  .object({
    id: lessonIdSchema,
  })
  .strict();

export const reorderLessonsSchema = z
  .object({
    moduleId: moduleIdSchema,
    orderedIds: orderedIdsSchema,
  })
  .strict();

export const moveLessonToModuleSchema = z
  .object({
    lessonId: lessonIdSchema,
    toModuleId: moduleIdSchema,
    toIndex: z.number().int().min(0).optional(),
  })
  .strict();

export type CreateModuleInput = z.input<typeof createModuleSchema>;
export type UpdateModuleInput = z.input<typeof updateModuleSchema>;
export type ReorderModulesInput = z.input<typeof reorderModulesSchema>;
export type CreateLessonInput = z.input<typeof createLessonSchema>;
export type UpdateLessonInput = z.input<typeof updateLessonSchema>;
export type ReorderLessonsInput = z.input<typeof reorderLessonsSchema>;
export type MoveLessonToModuleInput = z.input<typeof moveLessonToModuleSchema>;
