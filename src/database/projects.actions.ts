import { getFirestore } from 'firebase-admin/firestore';
import { app } from './firebase.config';
import db from './actions';

interface ProjectData {
  Name: string;
  Products: string[];
  Balance: number;
  Transactions: Array<{
    amount: number;
    date: string;
    description: string;
  }>;
}

/**
 * Reads all documents in the "projects" collection and returns them.
 * @returns {Promise<Array<Object>>} List of projects with their IDs and data.
 */
export async function getProjects() {
  try {
    const projectsCollection = db.collection('projects');
    const snapshot = await projectsCollection.get();

    if (snapshot.empty) {
      console.log('No documents found in "projects" collection.');
      return [];
    }

    // Map each document to include its auto-generated ID alongside its data fields
    const projects = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return projects;
  } catch (error) {
    console.error('Error fetching projects:', error);
    throw error;
  }
}

export async function createProject(projectData: ProjectData) {
  try {
    const projectsCollection = db.collection('projects');
    const newProjectRef = await projectsCollection.add(projectData);
    console.log(`Project created with ID: ${newProjectRef.id}`);
    return { id: newProjectRef.id, ...projectData };
  } catch (error) {
    console.error('Error creating project:', error);
    throw error;
  }
}

export async function updateProjectData(projectId: string, updatedData: Partial<ProjectData>) {
  try {
    const projectRef = db.collection('projects').doc(projectId);
    await projectRef.update(updatedData);
    console.log(`Project with ID: ${projectId} updated successfully.`);
  } catch (error) {
    console.error(`Error updating project with ID: ${projectId}`, error);
    throw error;
  }
}

export async function deleteProject(projectId: string) {
  try {
    const projectRef = db.collection('projects').doc(projectId);
    await projectRef.delete();
    console.log(`Project with ID: ${projectId} deleted successfully.`);
  } catch (error) {
    console.error(`Error deleting project with ID: ${projectId}`, error);
    throw error;
  }
}

export async function getProjectById(projectId: string) {
  try {
    const projectRef = db.collection('projects').doc(projectId);
    const doc = await projectRef.get();

    if (!doc.exists) {
      console.log(`No project found with ID: ${projectId}`);
      return null;
    }

    return { id: doc.id, ...doc.data() };
  } catch (error) {
    console.error(`Error fetching project with ID: ${projectId}`, error);
    throw error;
  }
}

export async function addTransactionToProject() {
  console.log("addTransactionToProject - not implemented yet");
}

export async function getProjectTransactions(projectId: string) {
  try {
    const projectRef = db.collection('projects').doc(projectId);
    const doc = await projectRef.get();

    if (!doc.exists) {
      console.log(`No project found with ID: ${projectId}`);
      return [];
    }

    const projectData = doc.data() as ProjectData;
    return projectData.Transactions || [];
  } catch (error) {
    console.error(`Error fetching transactions for project with ID: ${projectId}`, error);
    throw error;
  }
}

async function updateProjectBalance(projectId: string, newBalance: number) {
  try {
    const projectRef = db.collection('projects').doc(projectId);
    await projectRef.update({ Balance: newBalance });
    console.log(`Project with ID: ${projectId} balance updated to ${newBalance}.`);
  } catch (error) {
    console.error(`Error updating balance for project with ID: ${projectId}`, error);
    throw error;
  }
}