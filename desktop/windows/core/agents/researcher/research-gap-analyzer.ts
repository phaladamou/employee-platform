import type { ResearchSource } from "./research-types";

interface ResearchGapAnalyzerLLM {
  generate(input: {
    messages: Array<{
      role: "system" | "user";
      content: string;
    }>;
    temperature?: number;
  }): Promise<{
    content: string;
  }>;
}

export type ResearchGapPriority =
  | "high"
  | "medium"
  | "low";

export interface ResearchGap {
  readonly claim: string;
  readonly problem: string;
  readonly priority: ResearchGapPriority;
  readonly searchQueries: readonly string[];
}

export interface ResearchGapAnalysis {
  readonly gaps: readonly ResearchGap[];
}

export class ResearchGapAnalyzer {
  constructor(
    private readonly llm: ResearchGapAnalyzerLLM
  ) {}

  async analyze(
    researchQuestion: string,
    sources: readonly ResearchSource[]
  ): Promise<ResearchGapAnalysis> {
    const sourceContext = sources
      .map(
        (source, index) => `
Source ${index + 1}

Title:
${source.title}

URL:
${source.url}

Content:
${source.snippet}

Evaluation:
Score: ${source.evaluation?.score ?? "unknown"}/100
Type: ${source.evaluation?.sourceType ?? "unknown"}
Credibility: ${source.evaluation?.credibility ?? "unknown"}/100
Relevance: ${source.evaluation?.relevance ?? "unknown"}/100
Evidence quality: ${source.evaluation?.evidenceQuality ?? "unknown"}/100
Recency: ${source.evaluation?.recency ?? "unknown"}/100
`
      )
      .join("\n");

    const response = await this.llm.generate({
      messages: [
        {
          role: "system",
          content: `
You are the research-gap analysis component of Scientia Labs.

Your job is NOT to answer the research question.

Your job is to identify what is still missing from the available evidence.

Analyze the available sources and identify only the most important evidence gaps.

Look for:

1. Important claims without strong evidence.
2. Claims supported only by weak sources.
3. Claims supported only by secondary or tertiary sources.
4. Important facts that require primary research.
5. Contradictions between sources.
6. Missing dates, measurements, methodology or verification.
7. Important subquestions that have not been adequately researched.

For each gap provide:

- claim
- problem
- priority
- searchQueries

Priority must be one of:

- high
- medium
- low

Search queries must be concrete and useful for retrieving stronger evidence.

Prefer queries targeting:

- peer-reviewed papers
- Nature
- Science
- PubMed
- arXiv
- official institutional research
- university research pages
- original research papers

IMPORTANT:

- Do not invent facts.
- Do not repeat every weakness you find.
- Return only the 3 to 5 most important research gaps.
- Each gap should contain at most 3 search queries.
- Keep claim and problem concise.
- Keep each search query concise.
- Do not include markdown.
- Do not include explanations outside the JSON.
- Return ONLY valid JSON.

Required format:

{
  "gaps": [
    {
      "claim": "string",
      "problem": "string",
      "priority": "high",
      "searchQueries": [
        "string",
        "string"
      ]
    }
  ]
}
`
        },
        {
          role: "user",
          content: `
Research question:

${researchQuestion}

Available evidence:

${sourceContext}

Identify the 3 to 5 most important research gaps.
Return ONLY valid JSON.
`
        }
      ],
      temperature: 0.1
    });

    return this.parseResponse(response.content);
  }

  private parseResponse(
    content: string
  ): ResearchGapAnalysis {
    try {
      const cleaned = this.cleanLLMResponse(content);

      const json = this.extractJsonObject(cleaned);

      if (!json) {
        console.warn(
          "[ResearchGapAnalyzer] No valid JSON object found."
        );

        return {
          gaps: []
        };
      }

      const parsed = JSON.parse(json) as {
        gaps?: unknown;
      };

      if (!Array.isArray(parsed.gaps)) {
        console.warn(
          "[ResearchGapAnalyzer] JSON does not contain a valid gaps array."
        );

        return {
          gaps: []
        };
      }

      const gaps: ResearchGap[] = [];

      for (const item of parsed.gaps) {
        if (!item || typeof item !== "object") {
          continue;
        }

        const candidate = item as Record<
          string,
          unknown
        >;

        const claim =
          typeof candidate.claim === "string"
            ? candidate.claim.trim()
            : "";

        const problem =
          typeof candidate.problem === "string"
            ? candidate.problem.trim()
            : "";

        const priority: ResearchGapPriority =
          candidate.priority === "high" ||
          candidate.priority === "medium" ||
          candidate.priority === "low"
            ? candidate.priority
            : "medium";

        const searchQueries = Array.isArray(
          candidate.searchQueries
        )
          ? candidate.searchQueries
              .filter(
                (query): query is string =>
                  typeof query === "string" &&
                  query.trim().length > 0
              )
              .map((query) => query.trim())
              .slice(0, 3)
          : [];

        if (!claim || !problem) {
          continue;
        }

        gaps.push({
          claim,
          problem,
          priority,
          searchQueries
        });
      }

      return {
        gaps: gaps.slice(0, 5)
      };
    } catch (error) {
      console.warn(
        "[ResearchGapAnalyzer] Failed to parse response:",
        error
      );

      console.warn(
        "[ResearchGapAnalyzer] Raw response preview:",
        content.slice(0, 2000)
      );

      return {
        gaps: []
      };
    }
  }

  private cleanLLMResponse(
    content: string
  ): string {
    return content
      .replace(/^\uFEFF/, "")
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();
  }

  private extractJsonObject(
    content: string
  ): string | null {
    const start = content.indexOf("{");

    if (start === -1) {
      return null;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (
      let index = start;
      index < content.length;
      index++
    ) {
      const char = content[index];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (inString) {
        continue;
      }

      if (char === "{") {
        depth++;
      }

      if (char === "}") {
        depth--;

        if (depth === 0) {
          return content.slice(start, index + 1);
        }
      }
    }

    return null;
  }
}
