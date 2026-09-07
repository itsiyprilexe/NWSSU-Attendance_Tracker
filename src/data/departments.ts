// src/data/departments.ts
import { Department } from "../types";

export const DEPARTMENTS: Department[] = [
  {
    code: "CAT",
    name: "College of Agriculture and Technology",
    color: "#3E7C4A",
    logo: require("../../assets/images/departments/cat-removebg-preview.png"),
    allowedCourses: ["BSA", "BSAT"],
  },
  {
    code: "CCIS",
    name: "College of Computer and Information Sciences",
    color: "#F4B400",
    logo: require("../../assets/images/departments/ccis-removebg-preview.png"),
    allowedCourses: ["BSCS", "BSIS", "BSIT", "BSMA"],
  },
  {
    code: "CCJS",
    name: "College of Criminal Justice and Sciences",
    color: "#8A8A8A",
    logo: require("../../assets/images/departments/ccjs-removebg-preview.png"),
    allowedCourses: ["BSCRIM"],
  },
  {
    code: "COED",
    name: "College of Education",
    color: "#29ABE2",
    logo: require("../../assets/images/departments/coed-removebg-preview.png"),
    allowedCourses: ["BEED", "BSED"],
  },
  {
    code: "CEA",
    name: "College of Engineering and Architecture",
    color: "#2E5339",
    logo: require("../../assets/images/departments/cea-removebg-preview.png"),
    allowedCourses: ["BSCE", "BSEE", "BSME", "BSARCH"],
  },
  {
    code: "COM",
    name: "College of Management",
    color: "#1F4E8C",
    logo: require("../../assets/images/departments/com-removebg-preview.png"),
    allowedCourses: ["BSBA", "BSA-ACC"],
  },
  {
    code: "CON",
    name: "College of Nursing",
    color: "#C0392B",
    logo: require("../../assets/images/departments/con-removebg-preview.png"),
    allowedCourses: ["BSN"],
  },
];

export function getDepartmentByCode(code: string): Department | undefined {
  return DEPARTMENTS.find((d) => d.code === code);
}