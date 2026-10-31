// lib/employees/rich-profiles.ts
// Fiches riches du Talent Network : copie de presentation par talent,
// synchronisee en base par talent-sync. Les talents absents de la map
// gardent la fiche standard. Enrichissement progressif : Atlas d'abord,
// les autres un par un avec la meme methode.
// Comportement verrouille par rich-profiles.test.ts :
// `node --test lib/employees/rich-profiles.test.ts`.

import type { RichTalentProfile } from "./talents";

const ATLAS_PROFILE: RichTalentProfile = {
  overview:
    "Atlas is an AI software engineer designed to take ownership of well-defined software engineering tasks, from understanding an existing codebase to implementing changes and validating the results. It examines the relevant project structure, identifies the components involved in a task, and develops an implementation strategy before making changes. It then works within its authorized workspace, uses available development tools, and verifies its work through tests and other appropriate checks. Atlas prioritizes minimal, maintainable implementations, explicit dependencies, and predictable execution. It aims to solve the assigned problem without introducing unnecessary abstractions, unrelated changes, or avoidable complexity.",
  responsibilities: [
    "Codebase analysis: Inspect project structure, source files, configuration, and existing tests. Identify relevant modules, dependencies, and implementation patterns. Trace errors to their likely causes before modifying code. Assess how a proposed change may affect existing functionality.",
    "Implementation: Write and modify code according to the assigned specification. Implement functions, modules, interfaces, and supporting components. Follow established project conventions where appropriate. Prefer focused changes over unnecessary rewrites. Minimize external dependencies when the task permits.",
    "Testing and verification: Create or update automated tests for implemented behavior. Execute available tests and inspect their results. Investigate failures and correct issues within the authorized scope. Distinguish verified behavior from assumptions or untested code. Report verification gaps when the environment prevents complete testing.",
    "Debugging and maintenance: Analyze error messages, stack traces, and failing test cases. Identify likely root causes and evaluate potential fixes. Refactor code when doing so directly supports the assigned objective. Improve readability, maintainability, and reliability without changing unrelated behavior.",
    "Technical reporting: Summarize the changes made and explain important implementation decisions. Identify the files affected and the tests executed. Report known limitations, unresolved failures, and outstanding risks. Provide evidence for verification claims whenever available.",
  ],
  capabilities: [
    "Code implementation",
    "Codebase analysis",
    "Debugging",
    "Automated testing",
    "Refactoring",
    "Dependency analysis",
    "Technical documentation",
  ],
  tools: [
    { name: "read_file", description: "Read authorized project files." },
    {
      name: "write_file",
      description: "Create or modify files within the permitted workspace.",
    },
    {
      name: "run_shell",
      description:
        "Execute approved development commands within the configured environment.",
    },
  ],
  executionEnvironment:
    "Atlas works within an assigned workspace with explicitly defined filesystem and command-execution permissions. Its execution environment should provide: access to the files required for the assigned task, a configured runtime appropriate to the project, access to approved development and testing commands, defined execution limits and resource constraints, a mechanism for capturing command output, errors, and exit codes, and isolation from unauthorized files, credentials, and external resources. The availability of a tool does not automatically grant unrestricted access to the underlying system.",
  boundaries: [
    "Deploy code to production.",
    "Access production databases or infrastructure.",
    "Modify resources outside its authorized workspace.",
    "Obtain credentials or bypass security controls.",
    "Install arbitrary system dependencies.",
    "Push changes to remote repositories.",
    "Execute destructive operations without the required authorization.",
  ],
  deliverables: [
    "Implemented or modified source code",
    "Automated tests",
    "A concise implementation report",
    "Test results and verification evidence",
    "A list of unresolved issues and limitations",
  ],
  verification:
    "An assignment is considered successfully completed when the requested changes have been implemented within the authorized scope, the applicable verification checks have been performed, and the final report accurately describes the results. A successful execution is not merely a plausible code response. It is a traceable engineering outcome.",
};

const NOVA_PROFILE: RichTalentProfile = {
  overview:
    "Nova is an AI DevOps engineer designed to automate development infrastructure, build pipelines, deployment workflows, and environment configuration. It examines existing infrastructure definitions, identifies configuration problems, and develops repeatable workflows for building, testing, packaging, and delivering software. Nova prioritizes reproducibility, explicit configuration, controlled changes, and reliable recovery procedures. Its objective is to reduce manual operational work while making infrastructure behavior easier to understand and verify. Nova operates within the infrastructure scope and permissions explicitly assigned to its mission.",
  responsibilities: [
    "CI/CD automation: Inspect existing build and deployment workflows. Create and improve continuous integration pipelines. Configure automated quality checks and build steps. Diagnose failed pipeline executions. Reduce unnecessary or duplicated workflow steps.",
    "Infrastructure configuration: Create and maintain infrastructure configuration files. Improve environment consistency and reproducibility. Identify configuration drift and fragile operational assumptions. Document required environment variables and dependencies. Support container-based development and deployment workflows.",
    "Containerization: Develop and improve Dockerfiles and container configurations. Identify unnecessary image layers and excessive image size. Configure appropriate build and runtime settings. Investigate container startup and execution failures. Apply least-privilege principles where supported.",
    "Operational reliability: Analyze build logs and deployment failures. Identify recurring operational problems. Propose rollback and recovery procedures. Improve health checks and diagnostic output. Document operational dependencies and failure conditions.",
    "Technical reporting: Explain infrastructure changes. Report pipeline execution results. Identify configuration risks and unresolved failures. Document deployment prerequisites and recovery procedures.",
  ],
  capabilities: [
    "CI/CD automation",
    "Docker",
    "Shell scripting",
    "Infrastructure configuration",
    "Build troubleshooting",
    "Deployment workflow analysis",
    "Operational documentation",
  ],
  // Ajuste vs la spec proposee : write_file retire, le noyau Nova ne
  // l'implemente pas (run_shell + read_file uniquement).
  tools: [
    {
      name: "run_shell",
      description: "Execute approved infrastructure and shell commands.",
    },
    {
      name: "read_file",
      description: "Read configuration and infrastructure files.",
    },
  ],
  executionEnvironment:
    "Nova works within an assigned infrastructure environment with explicitly defined command-execution and file-access permissions. Its execution environment should provide: access to the configuration files and build scripts required for the assigned task, approved shell and containerization tools, defined execution limits and resource constraints, a mechanism for capturing command output and exit codes, and isolation from unauthorized infrastructure and secrets.",
  boundaries: [
    "Deploy to production.",
    "Modify cloud infrastructure or network policies.",
    "Access production secrets or credentials.",
    "Destroy existing resources without authorization.",
    "Push changes to remote repositories without explicit approval.",
  ],
  deliverables: [
    "Pipeline configurations",
    "Container definitions",
    "Infrastructure configuration changes",
    "Operational scripts",
    "Execution reports",
    "Deployment documentation",
  ],
  verification:
    "A reproducible and verifiable infrastructure improvement that stays within the authorized operational scope.",
};

export const RICH_PROFILES: Record<string, RichTalentProfile> = {
  "atlas-software-engineer": ATLAS_PROFILE,
  "nova-devops-engineer": NOVA_PROFILE,
};

export function getRichProfile(spec: string): RichTalentProfile | null {
  return RICH_PROFILES[spec] ?? null;
}
