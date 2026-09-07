// src/types/index.ts

export interface Department {
  code: string;
  name: string;
  color: string;
  logo: number | null; // result of require(...) is a number in RN, or null for placeholder
  allowedCourses: string[];
}

export interface AdminProfile {
  email: string;
  departmentCode: string;
  role: "Admin";
  createdAt?: unknown; // Firestore Timestamp
}

// Params for the pre-login (Auth) stack
export type AuthStackParamList = {
  DepartmentSelect: undefined;
  Login: { department: Department };
  CreateAccount: { department?: Department };
};

// Params for the post-login (Main) stack — grows as real screens are added
export type MainStackParamList = {
  Dashboard: undefined;
};
