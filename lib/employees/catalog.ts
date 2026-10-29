// lib/employees/catalog.ts
// Catalogue v1 de la vision "Employee" : donnees statiques typees +
// helpers purs (sans dependance Next/React).
// Comportement verrouille par catalog.test.ts :
// `node --test lib/employees/catalog.test.ts`.

export type EmployeeStatus = "idle" | "working" | "completed";

export interface Department {
  id: string;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  status: EmployeeStatus;
  departmentId: string;
  currentTask?: string;
}

export interface AvailableAgent {
  id: string;
  name: string;
  role: string;
  description: string;
  capabilities: string[];
}

export const DEPARTMENTS: Department[] = [
  { id: "engineering" },
  { id: "marketing" },
  { id: "research" },
];

export const EMPLOYEES: Employee[] = [
  {
    id: "emp-aria",
    name: "Aria",
    role: "Backend Developer",
    status: "working",
    departmentId: "engineering",
    currentTask: "Refactoring the chat streaming pipeline",
  },
  {
    id: "emp-jules",
    name: "Jules",
    role: "Frontend Developer",
    status: "working",
    departmentId: "engineering",
    currentTask: "Building the design system tokens",
  },
  {
    id: "emp-nova",
    name: "Nova",
    role: "QA Engineer",
    status: "idle",
    departmentId: "engineering",
  },
  {
    id: "emp-milo",
    name: "Milo",
    role: "Content Strategist",
    status: "completed",
    departmentId: "marketing",
  },
  {
    id: "emp-sana",
    name: "Sana",
    role: "SEO Analyst",
    status: "working",
    departmentId: "marketing",
    currentTask: "Auditing landing page keywords",
  },
  {
    id: "emp-theo",
    name: "Theo",
    role: "Research Scientist",
    status: "working",
    departmentId: "research",
    currentTask: "Benchmarking retrieval models",
  },
  {
    id: "emp-lena",
    name: "Lena",
    role: "Data Analyst",
    status: "idle",
    departmentId: "research",
  },
];

export const AVAILABLE_AGENTS: AvailableAgent[] = [
  {
    id: "agent-devops",
    name: "Kai",
    role: "DevOps Engineer",
    description: "Automates builds, deploys and infrastructure monitoring.",
    capabilities: ["CI/CD", "Docker", "Monitoring"],
  },
  {
    id: "agent-writer",
    name: "Iris",
    role: "Technical Writer",
    description: "Turns specs and code into clear documentation.",
    capabilities: ["Docs", "API references", "Tutorials"],
  },
  {
    id: "agent-support",
    name: "Noah",
    role: "Support Agent",
    description: "Triages tickets and drafts first-line answers.",
    capabilities: ["Ticketing", "FAQ", "Escalation"],
  },
  {
    id: "agent-designer",
    name: "Zoe",
    role: "Product Designer",
    description: "Explores layouts and prototypes user flows.",
    capabilities: ["Wireframes", "Prototypes", "Design review"],
  },
];

export function getEmployeesByDepartment(
  employees: Employee[],
  departmentId: string
): Employee[] {
  return employees.filter((e) => e.departmentId === departmentId);
}

export function countByStatus(
  employees: Employee[]
): Record<EmployeeStatus, number> {
  const counts: Record<EmployeeStatus, number> = {
    idle: 0,
    working: 0,
    completed: 0,
  };
  for (const employee of employees) {
    counts[employee.status] += 1;
  }
  return counts;
}

export function isKnownDepartment(departmentId: string): boolean {
  return DEPARTMENTS.some((d) => d.id === departmentId);
}

// Recrutement pur : retourne une nouvelle liste (l'entree n'est jamais
// mutee). Le nouvel employe demarre "idle", sans tache en cours.
export function recruitEmployee(
  employees: Employee[],
  agent: AvailableAgent,
  departmentId: string,
  id: string
): Employee[] {
  if (!isKnownDepartment(departmentId)) {
    throw new Error(`Unknown department: ${departmentId}`);
  }
  return [
    ...employees,
    {
      id,
      name: agent.name,
      role: agent.role,
      status: "idle",
      departmentId,
    },
  ];
}
