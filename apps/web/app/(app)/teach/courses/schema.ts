import { z } from "zod";

export const courseIdSchema = z.string().min(1);

export const createCourseSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().max(5000).nullish(),
    priceCents: z.number().int().min(0).default(0),
    discountPercent: z.number().int().min(0).max(100).default(0),
    isFree: z.boolean().default(false),
  })
  .strict();

export const updateCourseSchema = z
  .object({
    id: courseIdSchema,
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(5000).nullish(),
    priceCents: z.number().int().min(0).optional(),
    discountPercent: z.number().int().min(0).max(100).optional(),
    isFree: z.boolean().optional(),
  })
  .strict();

export const deleteCourseSchema = z
  .object({
    id: courseIdSchema,
  })
  .strict();

export const publishCourseSchema = z
  .object({
    id: courseIdSchema,
  })
  .strict();

export type CreateCourseInput = z.input<typeof createCourseSchema>;
export type UpdateCourseInput = z.input<typeof updateCourseSchema>;
export type DeleteCourseInput = z.input<typeof deleteCourseSchema>;
export type PublishCourseInput = z.input<typeof publishCourseSchema>;
