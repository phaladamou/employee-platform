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

export interface AgentReview {
  author: string;
  rating: number;
  text: string;
}

export interface AvailableAgent {
  id: string;
  name: string;
  role: string;
  description: string;
  capabilities: string[];
  category: AgentCategory;
  rating: number;
  reviewsCount: number;
  experience: string;
  reviews: AgentReview[];
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
    rating: 4.8,
    reviewsCount: 124,
    experience: "5 years running production infrastructure",
    reviews: [
      {
        author: "Lena",
        rating: 5,
        text: "Kai cut our deploy time from hours to minutes.",
      },
      {
        author: "Marc",
        rating: 4,
        text: "Solid pipelines, needs clear access scopes upfront.",
      },
    ],
  },
  {
    id: "agent-backend",
    name: "Ravi",
    role: "Backend Developer",
    description: "Designs resilient APIs and data pipelines.",
    capabilities: ["APIs", "Postgres", "Queues"],
    category: "development",
    rating: 4.9,
    reviewsCount: 210,
    experience: "6 years shipping backend systems",
    reviews: [
      {
        author: "Sana",
        rating: 5,
        text: "Ravi rebuilt our API layer without a single outage.",
      },
      {
        author: "Tom",
        rating: 5,
        text: "Fast, thorough, great documentation habits.",
      },
    ],
  },
  {
    id: "agent-researcher",
    name: "Mira",
    role: "Research Scientist",
    description: "Evaluates models and prototypes retrieval systems.",
    capabilities: ["LLM eval", "RAG", "Benchmarks"],
    category: "research",
    rating: 4.7,
    reviewsCount: 89,
    experience: "4 years in applied AI research",
    reviews: [
      {
        author: "Theo",
        rating: 5,
        text: "Mira's benchmarks settled our model debate in a week.",
      },
      {
        author: "Ana",
        rating: 4,
        text: "Rigorous analysis, slightly slow to start.",
      },
    ],
  },
  {
    id: "agent-analyst",
    name: "Otis",
    role: "Data Analyst",
    description: "Turns raw data into decisions.",
    capabilities: ["SQL", "Dashboards", "Forecasting"],
    category: "data",
    rating: 4.6,
    reviewsCount: 156,
    experience: "5 years in analytics",
    reviews: [
      {
        author: "Milo",
        rating: 5,
        text: "Otis found the churn pattern we all missed.",
      },
      {
        author: "Zoe",
        rating: 4,
        text: "Clear dashboards, asks sharp questions.",
      },
    ],
  },
  {
    id: "agent-dataeng",
    name: "Pia",
    role: "Data Engineer",
    description: "Builds pipelines your analysts will love.",
    capabilities: ["Pipelines", "dbt", "Warehousing"],
    category: "data",
    rating: 4.7,
    reviewsCount: 98,
    experience: "4 years in data platform teams",
    reviews: [
      {
        author: "Otis",
        rating: 5,
        text: "Pia's pipelines never break silently.",
      },
      {
        author: "Lena",
        rating: 4,
        text: "Solid work, great data contracts.",
      },
    ],
  },
  {
    id: "agent-designer",
    name: "Zoe",
    role: "Product Designer",
    description: "Explores layouts and prototypes user flows.",
    capabilities: ["Wireframes", "Prototypes", "Design review"],
    category: "design",
    rating: 4.9,
    reviewsCount: 178,
    experience: "6 years designing SaaS products",
    reviews: [
      {
        author: "Jules",
        rating: 5,
        text: "Zoe's prototypes test themselves.",
      },
      {
        author: "Mia",
        rating: 5,
        text: "Turned vague ideas into a shippable flow.",
      },
    ],
  },
  {
    id: "agent-support",
    name: "Noah",
    role: "Support Agent",
    description: "Triages tickets and drafts first-line answers.",
    capabilities: ["Ticketing", "FAQ", "Escalation"],
    category: "operations",
    rating: 4.5,
    reviewsCount: 232,
    experience: "3 years in customer operations",
    reviews: [
      {
        author: "Sam",
        rating: 4,
        text: "Noah clears the queue before standup.",
      },
      {
        author: "Eva",
        rating: 5,
        text: "Customers ask for Noah by name.",
      },
    ],
  },
  {
    id: "agent-writer",
    name: "Iris",
    role: "Technical Writer",
    description: "Turns specs and code into clear documentation.",
    capabilities: ["Docs", "API references", "Tutorials"],
    category: "operations",
    rating: 4.8,
    reviewsCount: 141,
    experience: "5 years documenting developer tools",
    reviews: [
      {
        author: "Ravi",
        rating: 5,
        text: "Iris documented our API better than we knew it.",
      },
      {
        author: "Kim",
        rating: 4,
        text: "Fast turnaround, precise language.",
      },
    ],
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

// Filtre marketplace : categorie exacte + recherche plein texte
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
