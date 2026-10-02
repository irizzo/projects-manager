import { getFirestore } from 'firebase-admin/firestore';
import { app } from './firebase.config';

// Initialize Firestore
const db = getFirestore(app);

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
