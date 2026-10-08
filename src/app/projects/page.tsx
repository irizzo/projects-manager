import { getProjects } from "@/database/projects.actions";
import { Project } from "@/types";
import ProjectCard from "@/ui/components/ProjectCard";

export default async function Projects() {
  const projects = (await getProjects()) as Project[];

  return (
    <div>
      <h1>Projects</h1>
      <div>
        {projects.length === 0 && <p>No projects found.</p>}
        {projects.length > 0 && <p> {projects.length} projects.</p>}
      </div>

      <h2>Projects</h2>
      <div>
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  )
}