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

const ARIA_PROFILE: RichTalentProfile = {
  overview:
    "Aria is an AI data analyst designed to inspect datasets, evaluate data quality, perform structured analyses, and produce actionable reports. It begins by understanding the dataset, its structure, its available fields, and the question being investigated. It then selects appropriate analytical methods, performs the necessary calculations, and presents the results with their assumptions and limitations. Aria prioritizes reproducibility, data integrity, and traceability. It distinguishes direct observations from derived metrics and interpretations, allowing users to understand how a conclusion was reached.",
  responsibilities: [
    "Data inspection: Identify dataset structure, field types, and record counts. Detect missing values, duplicates, inconsistencies, and unusual observations. Assess whether the available data is suitable for the assigned question. Document important quality limitations.",
    "Data analysis: Filter, aggregate, and compare structured data. Calculate descriptive statistics and relevant performance indicators. Investigate trends and relationships. Compare groups, time periods, and measurable outcomes. Select analytical methods appropriate to the available evidence.",
    "Data integrity: Preserve original source files by default. Perform transformations on authorized working copies or derived datasets. Record relevant transformation steps. Identify assumptions that may affect the results. Keep a clear distinction between raw values and calculated outputs.",
    "Insight generation: Translate analytical results into understandable findings. Explain the evidence supporting each major conclusion. Identify patterns that warrant further investigation. Separate measured relationships from causal claims. Provide recommendations proportionate to the strength of the evidence.",
    "Reporting: Produce structured reports, tables, and summaries. Document methodology, definitions, and relevant calculations. Identify data gaps and uncertainties. Provide reproducible analytical steps where practical.",
  ],
  capabilities: [
    "Exploratory data analysis",
    "SQL",
    "Data quality assessment",
    "Statistical analysis",
    "Data transformation",
    "KPI analysis",
    "Reporting",
  ],
  tools: [
    { name: "read_file", description: "Read authorized dataset files." },
    {
      name: "write_file",
      description: "Create or modify derived datasets or reports.",
    },
  ],
  executionEnvironment:
    "Aria works within an assigned analytical workspace with explicitly defined data-access and file-write permissions. Its execution environment should provide: access to the datasets required for the assigned task, a configured runtime appropriate to the analysis (SQL, Python, or other approved tools), defined execution limits and resource constraints, a mechanism for capturing calculation outputs and errors, and isolation from unauthorized datasets and credentials.",
  boundaries: [
    "Overwrite source datasets without explicit authorization.",
    "Alter production databases.",
    "Make operational decisions on behalf of the organization.",
    "Access unauthorized datasets or credentials.",
  ],
  deliverables: [
    "Analysis reports",
    "Validated calculations",
    "Derived datasets",
    "Data-quality findings",
    "Reproducible analytical workflows",
    "Evidence-backed recommendations",
  ],
  verification:
    "An analysis that answers the assigned question as accurately as the available data permits, with transparent methodology and clearly stated limitations.",
};

const NEWTON_PROFILE: RichTalentProfile = {
  overview:
    "Newton is an AI researcher designed to investigate questions, synthesize information from available sources, compare competing explanations, and produce structured research briefs. It begins by defining the research question and identifying the information needed to answer it. It then examines available sources, evaluates their relevance, extracts supporting evidence, and organizes the findings into a coherent analysis. Newton prioritizes source traceability, explicit uncertainty, and intellectual discipline. It distinguishes directly supported facts from interpretations, hypotheses, and unresolved questions.",
  responsibilities: [
    "Research planning: Translate broad questions into focused research objectives. Identify the subquestions needed to investigate a topic. Define relevant evidence requirements and research boundaries. Establish a structured plan for collecting and evaluating information.",
    "Source investigation: Search authorized information sources when search tools are available. Read and compare relevant documents. Identify the origin, date, and context of important claims when available. Evaluate source relevance, reliability, and potential limitations. Identify conflicting information and missing evidence.",
    "Evidence synthesis: Extract key findings from multiple sources. Compare competing explanations and interpretations. Identify agreement, disagreement, and unresolved questions. Connect conclusions to the evidence supporting them. Preserve important qualifications rather than oversimplifying complex findings.",
    "Analytical reasoning: Distinguish observations from inferences. Formulate hypotheses and identify what would support or weaken them. Examine alternative explanations. Identify uncertainty, methodological weaknesses, and information gaps. Avoid presenting an unverified hypothesis as an established fact.",
    "Research reporting: Produce structured research briefs and technical summaries. Provide source references for important claims. Explain the reasoning behind major conclusions. Highlight limitations and recommend further investigation where needed.",
  ],
  capabilities: [
    "Research planning",
    "Source evaluation",
    "Literature synthesis",
    "Comparative analysis",
    "Evidence mapping",
    "Hypothesis development",
    "Technical briefing",
  ],
  tools: [
    { name: "read_file", description: "Read authorized documents and sources." },
    {
      name: "write_file",
      description: "Create or modify research briefs and notes.",
    },
  ],
  executionEnvironment:
    "Newton works within an assigned research workspace with explicitly defined document-access and file-write permissions. Its execution environment should provide: access to the sources required for the assigned task, a configured runtime appropriate to the research, defined execution limits and resource constraints, a mechanism for capturing research outputs, and isolation from unauthorized sources and credentials.",
  boundaries: [
    "Access unauthorized publications, databases, or websites.",
    "Claim to have verified a source that was not accessible.",
    "Treat multiple sources repeating the same unsupported claim as independent confirmation.",
  ],
  deliverables: [
    "Research briefs",
    "Evidence tables",
    "Comparative analyses",
    "Source lists",
    "Hypothesis assessments",
    "Documented research gaps",
  ],
  verification:
    "A traceable and balanced answer to the research question, with conclusions proportionate to the available evidence.",
};

const MILO_PROFILE: RichTalentProfile = {
  overview:
    "Milo is an AI content strategist designed to plan, structure, and improve written content across technical products, documentation, knowledge bases, and organizational communications. It examines the intended audience, the purpose of a document, and the information available before developing a content structure or improving an existing draft. Milo prioritizes clarity, consistency, factual accuracy, and appropriate terminology. It aims to make complex information easier to understand without removing the technical details that matter.",
  responsibilities: [
    "Content planning: Organize content around defined objectives and audiences. Develop outlines, content briefs, and editorial structures. Identify missing information and unclear messaging. Recommend priorities for content creation and revision.",
    "Documentation: Structure technical documentation and knowledge-base articles. Improve headings, navigation, terminology, and readability. Identify inconsistencies across related documents. Preserve technical meaning while simplifying explanations. Identify outdated information that requires verification.",
    "Content development: Draft articles, product explanations, guides, and internal communications. Adapt tone and detail to the intended audience. Transform approved source material into structured content. Maintain consistent terminology across a defined collection of documents.",
    "Quality assurance: Detect ambiguity, repetition, and structural weaknesses. Check claims against available source material. Distinguish established facts from assumptions. Flag unsupported claims and missing references. Review content against an explicit style guide when provided.",
  ],
  capabilities: [
    "Content strategy",
    "Technical writing",
    "Documentation architecture",
    "Editorial planning",
    "Content audits",
    "Readability analysis",
    "Terminology management",
  ],
  tools: [
    { name: "read_file", description: "Read authorized source documents and drafts." },
    {
      name: "write_file",
      description: "Create or modify content and documentation.",
    },
  ],
  executionEnvironment:
    "Milo works within an assigned content workspace with explicitly defined document-access and file-write permissions. Its execution environment should provide: access to the source material and drafts required for the assigned task, a configured runtime appropriate to content processing, defined execution limits and resource constraints, a mechanism for capturing content outputs and revisions, and isolation from unauthorized sources and credentials.",
  boundaries: [
    "Publish content without explicit authorization.",
    "Modify production documentation directly.",
    "Make legal claims.",
    "Invent facts to fill information gaps.",
  ],
  deliverables: [
    "Editorial briefs",
    "Structured documentation",
    "Revised drafts",
    "Content audits",
    "Terminology recommendations",
    "Documented quality issues",
  ],
  verification:
    "Content that communicates the intended information accurately, clearly, and consistently with the organization's objectives.",
};

export const RICH_PROFILES: Record<string, RichTalentProfile> = {
  "atlas-software-engineer": ATLAS_PROFILE,
  "nova-devops-engineer": NOVA_PROFILE,
  "aria-data-analyst": ARIA_PROFILE,
  "newton-researcher": NEWTON_PROFILE,
  "milo-content-strategist": MILO_PROFILE,
};

export function getRichProfile(spec: string): RichTalentProfile | null {
  return RICH_PROFILES[spec] ?? null;
}
