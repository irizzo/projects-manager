import { Project } from "@/types";

export default function ProjectCard({ project }: { project: Project }) {
  return (
    <div>
      <h2>{project.Name}</h2>
      <p>ID: {project.id}</p>
    </div>
  );
}
