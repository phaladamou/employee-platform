// lib/employees/catalog.ts
// Vision "Employee" : types + agents disponibles + helpers purs (sans
// dependance Next/React). Source de verite runtime = tables Department et
// Employee (migration 0004) ; EMPLOYEES ci-dessous est la reference du
// seed initial uniquement.
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

export type AgentCategory =
  | "development"
  | "research"
  | "data"
  | "design"
  | "operations";

export const AGENT_CATEGORIES: AgentCategory[] = [
  "development",
  "research",
  "data",
  "design",
  "operations",
];

export interface AvailableAgent {
  id: string;
  name: string;
  role: string;
  description: string;
  capabilities: string[];
  category: AgentCategory;
  experience: string;
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
    category: "development",
    experience: "5 years running production infrastructure",
  },
  {
    id: "agent-backend",
    name: "Ravi",
    role: "Backend Developer",
    description: "Designs resilient APIs and data pipelines.",
    capabilities: ["APIs", "Postgres", "Queues"],
    category: "development",
    experience: "6 years shipping backend systems",
  },
  {
    id: "agent-researcher",
    name: "Mira",
    role: "Research Scientist",
    description: "Evaluates models and prototypes retrieval systems.",
    capabilities: ["LLM eval", "RAG", "Benchmarks"],
    category: "research",
    experience: "4 years in applied AI research",
  },
  {
    id: "agent-analyst",
    name: "Otis",
    role: "Data Analyst",
    description: "Turns raw data into decisions.",
    capabilities: ["SQL", "Dashboards", "Forecasting"],
    category: "data",
    experience: "5 years in analytics",
  },
  {
    id: "agent-dataeng",
    name: "Pia",
    role: "Data Engineer",
    description: "Builds pipelines your analysts will love.",
    capabilities: ["Pipelines", "dbt", "Warehousing"],
    category: "data",
    experience: "4 years in data platform teams",
  },
  {
    id: "agent-designer",
    name: "Zoe",
    role: "Product Designer",
    description: "Explores layouts and prototypes user flows.",
    capabilities: ["Wireframes", "Prototypes", "Design review"],
    category: "design",
    experience: "6 years designing SaaS products",
  },
  {
    id: "agent-support",
    name: "Noah",
    role: "Support Agent",
    description: "Triages tickets and drafts first-line answers.",
    capabilities: ["Ticketing", "FAQ", "Escalation"],
    category: "operations",
    experience: "3 years in customer operations",
  },
  {
    id: "agent-writer",
    name: "Iris",
    role: "Technical Writer",
    description: "Turns specs and code into clear documentation.",
    capabilities: ["Docs", "API references", "Tutorials"],
    category: "operations",
    experience: "5 years documenting developer tools",
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

const EMPLOYEE_STATUSES: EmployeeStatus[] = ["idle", "working", "completed"];

// Garde-fou pour les statuts lus en base (colonne varchar libre).
export function isEmployeeStatus(value: unknown): value is EmployeeStatus {
  return EMPLOYEE_STATUSES.some((status) => status === value);
}

// Filtre du repertoire : categorie exacte + recherche plein texte
// insensible a la casse (chaque mot doit matcher quelque part).
export function filterAgents(
  agents: AvailableAgent[],
  query: string,
  category: AgentCategory | "all"
): AvailableAgent[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return agents.filter((agent) => {
    if (category !== "all" && agent.category !== category) {
      return false;
    }
    if (tokens.length === 0) {
      return true;
    }
    const haystack =
      `${agent.name} ${agent.role} ${agent.description} ${agent.capabilities.join(" ")}`.toLowerCase();
    return tokens.every((token) => haystack.includes(token));
  });
}
