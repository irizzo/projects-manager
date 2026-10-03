
import { getProjects } from "@/database/projects.actions";
export default async function Home() {
  const projects = (await getProjects()) as Array<{ id: string; Name: string }>;
  console.log("Fetched Projects:", JSON.stringify(projects, null, 2));

  return (
    <div>
      <h1>Welcome to the Entrepreneur Management App</h1>
    </div>
  );
}
