import { z } from "zod";

export const ProjectStatus = z.enum(["draft", "ordering", "building", "done"]);
export const PartStatus = z.enum(["need", "ordered", "have"]);

// Postgres timestamptz comes back as "2026-10-03T03:44:26.402688+00:00".
const IsoDateTime = z.string().datetime({ offset: true });

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(120),
  idea: z.string().max(2000),
  device_ids: z.array(z.string().min(1)).max(10),
  platform_id: z.string().min(1).max(64).nullable(),
  status: ProjectStatus,
  checklist: z.record(z.boolean()),
  parts: z.record(PartStatus),
  notes: z.string().max(5000),
  source: z.string().max(40).nullable(),
  created_at: IsoDateTime,
  updated_at: IsoDateTime,
  synced: z.boolean(),
});

export const ProjectInputSchema = ProjectSchema.omit({ synced: true });

export const ProjectPatchSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  idea: z.string().max(2000).optional(),
  device_ids: z.array(z.string().min(1)).max(10).optional(),
  platform_id: z.string().min(1).max(64).nullable().optional(),
  status: ProjectStatus.optional(),
  checklist: z.record(z.boolean()).optional(),
  parts: z.record(PartStatus).optional(),
  notes: z.string().max(5000).optional(),
  source: z.string().max(40).nullable().optional(),
  updated_at: IsoDateTime.optional(),
});

export type Project = z.infer<typeof ProjectSchema>;
export type ProjectInput = z.infer<typeof ProjectInputSchema>;
export type ProjectPatch = z.infer<typeof ProjectPatchSchema>;
export type ProjectStatus = z.infer<typeof ProjectStatus>;
export type PartStatus = z.infer<typeof PartStatus>;
