import type {
  ResearchSource,
  SourceEvaluation,
  SourceType
} from "./research-types";

interface SourceEvaluatorLLM {
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

export class SourceEvaluator {
  constructor(private readonly llm: SourceEvaluatorLLM) {}

  async evaluate(
    source: ResearchSource,
    researchQuestion: string
  ): Promise<SourceEvaluation> {
    const response = await this.llm.generate({
      messages: [
        {
          role: "system",
          content: `
You are the source evaluation component of Scientia Labs.

Evaluate a scientific or informational web source for a research task.

Assess:

1. sourceType
   - primary
   - secondary
   - tertiary
   - unknown

2. credibility
3. relevance
4. evidenceQuality
5. recency

All numerical values must be between 0 and 100.

The final score should reflect the overall usefulness of the source
for rigorous scientific research.

Important principles:

- Primary scientific papers generally provide stronger direct evidence.
- Peer-reviewed reviews can be highly credible but are secondary.
- Institutional sources can be credible but are not automatically primary.
- News articles are generally secondary.
- Blogs and generic aggregators are usually tertiary or weak secondary sources.
- YouTube summaries should generally receive low evidence-quality scores
  unless they clearly reference verifiable primary research.
- Recency matters, but a recent weak source is not automatically better
  than an older authoritative source.
- Do not treat the LLM's judgment as absolute truth.
- Do not invent publication details.

Return ONLY valid JSON:

{
  "score": number,
  "sourceType": "primary" | "secondary" | "tertiary" | "unknown",
  "credibility": number,
  "relevance": number,
  "evidenceQuality": number,
  "recency": number,
  "reasoning": string
}
`
        },
        {
          role: "user",
          content: `
Research question:
${researchQuestion}

Source title:
${source.title}

Source URL:
${source.url}

Source content:
${source.snippet}
`
        }
      ],
      temperature: 0.1
    });

    return this.parseResponse(response.content);
  }

  private parseResponse(content: string): SourceEvaluation {
    try {
      const cleaned = content
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      const parsed = JSON.parse(
        cleaned
      ) as Partial<SourceEvaluation>;

      const sourceType: SourceType =
        this.normalizeSourceType(parsed.sourceType);

      const credibility =
        this.normalizeScore(parsed.credibility);

      const relevance =
        this.normalizeScore(parsed.relevance);

      const evidenceQuality =
        this.normalizeScore(parsed.evidenceQuality);

      const recency =
        this.normalizeScore(parsed.recency);

      const calculatedScore = Math.round(
        credibility * 0.3 +
          relevance * 0.25 +
          evidenceQuality * 0.3 +
          recency * 0.15
      );

      return {
        score:
          typeof parsed.score === "number"
            ? this.normalizeScore(parsed.score)
            : calculatedScore,

        sourceType,

        credibility,
        relevance,
        evidenceQuality,
        recency,

        reasoning:
          typeof parsed.reasoning === "string"
            ? parsed.reasoning.trim()
            : "No reasoning provided."
      };
    } catch (error) {
      console.warn(
        "[SourceEvaluator] Failed to parse evaluation:",
        error
      );

      return {
        score: 0,
        sourceType: "unknown",
        credibility: 0,
        relevance: 0,
        evidenceQuality: 0,
        recency: 0,
        reasoning:
          "The source evaluation could not be reliably parsed."
      };
    }
  }

  private normalizeScore(value: unknown): number {
    if (
      typeof value !== "number" ||
      Number.isNaN(value)
    ) {
      return 0;
    }

    return Math.max(
      0,
      Math.min(100, Math.round(value))
    );
  }

  private normalizeSourceType(
    value: unknown
  ): SourceType {
    if (
      value === "primary" ||
      value === "secondary" ||
      value === "tertiary" ||
      value === "unknown"
    ) {
      return value;
    }

    return "unknown";
  }
}
