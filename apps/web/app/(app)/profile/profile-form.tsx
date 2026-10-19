"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { profileSchema, type ProfileFormValues } from "./schema";
import { updateProfile } from "./actions";

export default function ProfileForm({ initial }: { initial: ProfileFormValues }) {
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: initial,
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "socialLinks",
  });
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(values: ProfileFormValues) {
    setStatus(null);
    setError(null);
    try {
      await updateProfile(values);
      setStatus("Saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium" htmlFor="bio">
          Bio
        </label>
        <textarea
          id="bio"
          rows={4}
          className="mt-1 w-full rounded border p-2"
          {...form.register("bio")}
        />
        {form.formState.errors.bio && (
          <p className="text-sm text-red-600">{form.formState.errors.bio.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium" htmlFor="websiteUrl">
          Website URL
        </label>
        <input
          id="websiteUrl"
          type="url"
          className="mt-1 w-full rounded border p-2"
          {...form.register("websiteUrl")}
        />
        {form.formState.errors.websiteUrl && (
          <p className="text-sm text-red-600">
            {form.formState.errors.websiteUrl.message}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium" htmlFor="avatarUrl">
          Avatar URL
        </label>
        <input
          id="avatarUrl"
          type="url"
          className="mt-1 w-full rounded border p-2"
          {...form.register("avatarUrl")}
        />
        {form.formState.errors.avatarUrl && (
          <p className="text-sm text-red-600">
            {form.formState.errors.avatarUrl.message}
          </p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between">
          <span className="block text-sm font-medium">Social links</span>
          <button
            type="button"
            className="text-sm text-blue-600"
            onClick={() => append({ label: "", url: "" })}
          >
            Add
          </button>
        </div>
        <div className="mt-2 space-y-2">
          {fields.map((field, index) => (
            <div key={field.id} className="flex gap-2">
              <input
                className="w-1/3 rounded border p-2"
                placeholder="Label"
                {...form.register(`socialLinks.${index}.label`)}
              />
              <input
                className="flex-1 rounded border p-2"
                placeholder="https://..."
                {...form.register(`socialLinks.${index}.url`)}
              />
              <button
                type="button"
                className="text-sm text-red-600"
                onClick={() => remove(index)}
              >
                Remove
              </button>
              {form.formState.errors.socialLinks?.[index]?.label && (
                <p className="text-sm text-red-600">
                  {form.formState.errors.socialLinks[index]?.label?.message}
                </p>
              )}
              {form.formState.errors.socialLinks?.[index]?.url && (
                <p className="text-sm text-red-600">
                  {form.formState.errors.socialLinks[index]?.url?.message}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={form.formState.isSubmitting}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {form.formState.isSubmitting ? "Saving..." : "Save"}
      </button>
      {status && <p className="text-sm text-green-600">{status}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
