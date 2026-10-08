import type { Project } from "@/types";
import styles from "./styles.module.scss";

export default function ProjectCard({ project }: { project: Project }) {
  return (
    <div className={styles.card}>
      <h2 className={styles.title}>{project.name}</h2>
      <p className={styles.meta}>ID: {project.id}</p>
    </div>
  );
}