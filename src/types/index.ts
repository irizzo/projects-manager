export interface Project {
  id: string;
  name: string;
  description: string;
  balance: number;
  transactions: Transaction[];
}

export interface Transaction {
  id: string;
  projectId: string;
  amount: number;
  date: string;
  description: string;
}