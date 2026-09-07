import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { db } from '../firebase/config';

export interface Department {
  id: string;
  name: string;
  code: string;
}

let cachedDepartments: Department[] | null = null;

export async function fetchDepartments(): Promise<Department[]> {
  if (cachedDepartments) return cachedDepartments;

  const snap = await getDocs(collection(db, 'departments'));
  cachedDepartments = snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<Department, 'id'>),
  }));
  return cachedDepartments;
}

export async function getDepartmentIdByCode(code: string): Promise<string | null> {
  const departments = await fetchDepartments();
  const match = departments.find((d) => d.code.toUpperCase() === code.toUpperCase());
  return match ? match.id : null;
}