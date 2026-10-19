import { z } from "zod";

const socialLinkSchema = z.object({
  label: z.string().min(1),
  url: z.string().url(),
});

export const profileSchema = z.object({
  bio: z.string().max(1000),
  websiteUrl: z.union([z.literal(""), z.string().url()]),
  avatarUrl: z.union([z.literal(""), z.string().url()]),
  socialLinks: z.array(socialLinkSchema),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;
