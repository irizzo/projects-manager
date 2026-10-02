// import { useState, useEffect } from "react";
import { getProjects } from "@/database/actions";

import styles from "./page.module.css";

export default async function Home() {
  const projects = (await getProjects()) as Array<{ id: string; Name: string }>;
  console.log("Fetched Projects:", JSON.stringify(projects, null, 2));

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Welcome to the Entrepreneur Management App</h1>

      <h2 className={styles.subtitle}>Projects</h2>
      <ul className={styles.projectList}>
        {projects.map((project) => (
          <li key={project.id} className={styles.projectItem}>
            Project name: {project.Name}
          </li>
        ))}
      </ul>
    </div>
  );
}
