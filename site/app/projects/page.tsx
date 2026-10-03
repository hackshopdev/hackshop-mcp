import { ProjectsIndexClient } from "@/components/ProjectsIndexClient";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata(
  "My builds · Hackshop",
  "Saved Hackshop build drafts, parts status, step checklists, notes, and agent handoffs.",
  "/projects",
);

export default function ProjectsPage() {
  return <ProjectsIndexClient />;
}
