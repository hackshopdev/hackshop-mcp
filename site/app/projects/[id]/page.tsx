import { ProjectDetailClient } from "@/components/ProjectDetailClient";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata(
  "Build project · Hackshop",
  "Edit a saved Hackshop build draft with parts status, step checklist, notes, and an agent handoff.",
  "/projects",
);

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProjectDetailClient id={id} />;
}
