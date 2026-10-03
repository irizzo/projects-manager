import { getProjects } from "@/database/projects.actions";
import { Project } from "@/types";
import ProjectCard from "@/ui/components/ProjectCard";

export default async function Projects() {
  const projects = (await getProjects()) as Project[];

  return (
    <div>
      <h1>Projects</h1>
      <ul>
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </ul>
    </div>
  )
}