import type { Agent } from "../agent";
import type { AgentContext } from "../agent-context";

import type {
  ResearchResult,
  ResearchSource,
} from "./research-types";

import type { ResearchRequest } from "../../capabilities/research/research-request";
import type { ResearchResult as CapabilityResearchResult } from "../../capabilities/research/research-result";

import { SourceEvaluator } from "./source-evaluator";

import {
  ResearchGapAnalyzer,
  type ResearchGap,
} from "./research-gap-analyzer";

/*
 * ============================================================
 * CONFIGURATION
 * ============================================================
 */

const MAX_INITIAL_ITERATIONS = 3;
const MAX_INITIAL_SOURCES = 10;
const MAX_GAP_SEARCHES = 5;
const MAX_QUERIES_PER_GAP = 2;
const MAX_TOTAL_SOURCES = 30;
const MAX_FINAL_SOURCES = 20;
const MIN_FINAL_SCORE = 45;

/*
 * ============================================================
 * RESEARCHER AGENT
 * ============================================================
 */

export class ResearcherAgent implements Agent {
  readonly id = "researcher";
  readonly type = "researcher";

  private context: AgentContext | null = null;

  /*
   * ============================================================
   * INITIALIZATION
   * ============================================================
   */

  async initialize(context: AgentContext): Promise<void> {
    this.context = context;
  }

  /*
   * ============================================================
   * EXECUTION
   * ============================================================
   */

  async execute(input: unknown): Promise<ResearchResult> {
    if (!this.context) {
      throw new Error(
        "Researcher has not been initialized"
      );
    }

    const request: ResearchRequest = {
      question:
        typeof input === "object" &&
        input !== null &&
        "objective" in input &&
        typeof input.objective === "string"
          ? input.objective
          : "",
    };

    if (!request.question.trim()) {
      throw new Error(
        "Research question cannot be empty"
      );
    }

    const researchCapability =
      this.context.capabilities.get("research");

    if (!researchCapability) {
      throw new Error(
        "Research capability is not available"
      );
    }

    const llm =
      this.context.llmProviders.get("deepseek");

    if (!llm) {
      throw new Error(
        "DeepSeek provider is not available"
      );
    }

    const sourceEvaluator =
      new SourceEvaluator(llm);

    const gapAnalyzer =
      new ResearchGapAnalyzer(llm);

    const sources =
      new Map<string, ResearchSource>();

    const initialQueries =
      this.buildInitialQueries(
        request.question
      );

    for (
      let iteration = 0;
      iteration < initialQueries.length &&
      iteration < MAX_INITIAL_ITERATIONS;
      iteration++
    ) {
      const query =
        initialQueries[iteration];

      console.log(
        `[Researcher] Initial search ${
          iteration + 1
        }/${MAX_INITIAL_ITERATIONS}`
      );

      console.log(
        `[Researcher] Query: ${query}`
      );

      await this.executeSearch(
        query,
        researchCapability,
        sources,
        MAX_INITIAL_SOURCES
      );

      console.log(
        `[Researcher] Sources collected: ${sources.size}`
      );

      if (
        sources.size >=
        MAX_INITIAL_SOURCES
      ) {
        console.log(
          "[Researcher] Initial source limit reached."
        );

        break;
      }
    }

    if (sources.size === 0) {
      throw new Error(
        "No research results found"
      );
    }

    let sourceList =
      Array.from(sources.values());

    console.log(
      `[Researcher] Evaluating ${sourceList.length} initial sources...`
    );

    await this.evaluateSources(
      sourceList,
      sourceEvaluator,
      request.question
    );

    this.rankSources(sourceList);

    this.logRanking(
      sourceList,
      "Initial source ranking"
    );

    console.log(
      "[Researcher] Analyzing research gaps..."
    );

    const gapAnalysis =
      await gapAnalyzer.analyze(
        request.question,
        sourceList
      );

    console.log(
      `[Researcher] Research gaps detected: ${gapAnalysis.gaps.length}`
    );

    for (const gap of gapAnalysis.gaps) {
      console.log(
        `[Researcher] Gap (${gap.priority}): ${gap.claim}`
      );

      console.log(
        `[Researcher] Problem: ${gap.problem}`
      );

      for (const query of gap.searchQueries) {
        console.log(
          `[Researcher] Suggested search: ${query}`
        );
      }
    }

    const prioritizedGaps =
      this.prioritizeGaps(
        gapAnalysis.gaps
      );

    console.log(
      `[Researcher] Executing targeted research for ${prioritizedGaps.length} gaps...`
    );

    for (const gap of prioritizedGaps) {
      await this.executeGapResearch(
        gap,
        researchCapability,
        sources
      );

      if (
        sources.size >=
        MAX_TOTAL_SOURCES
      ) {
        console.log(
          "[Researcher] Maximum total source limit reached."
        );

        break;
      }
    }

    sourceList =
      Array.from(sources.values());

    const unevaluatedSources =
      sourceList.filter(
        (source) =>
          !source.evaluation
      );

    console.log(
      `[Researcher] New sources requiring evaluation: ${unevaluatedSources.length}`
    );

    await this.evaluateSources(
      unevaluatedSources,
      sourceEvaluator,
      request.question
    );

    sourceList =
      Array.from(sources.values());

    this.rankSources(sourceList);

    const strongSources =
      sourceList.filter(
        (source) =>
          (source.evaluation?.score ?? 0) >=
          MIN_FINAL_SCORE
      );

    const candidateSources =
      strongSources.length > 0
        ? strongSources
        : sourceList;

    const finalSources =
      candidateSources.slice(
        0,
        MAX_FINAL_SOURCES
      );

    this.logRanking(
      finalSources,
      "Final source ranking"
    );

    console.log(
      `[Researcher] Synthesizing ${finalSources.length} sources...`
    );

    const researchContext =
      this.buildResearchContext(
        finalSources
      );

    const response =
      await llm.generate({
        messages: [
          {
            role: "system",
            content: [
              "You are the scientific research agent of Scientia Labs.",
              "",
              "Your task is to produce a rigorous, evidence-aware scientific synthesis.",
              "",
              "CORE RULES:",
              "1. Prioritize primary research and peer-reviewed evidence.",
              "2. Distinguish primary, secondary, tertiary, and weak sources.",
              "3. Never treat a weak source as strong evidence.",
              "4. Never invent citations, studies, authors, dates, numbers, or findings.",
              "5. Every important factual claim must be traceable to the provided sources.",
              "6. Cite evidence using Source 1, Source 2, etc.",
              "7. If sources disagree, explicitly describe the disagreement.",
              "8. If evidence is insufficient, explicitly say so.",
              "9. Distinguish established findings from preliminary findings.",
              "10. Distinguish scientific evidence from speculation or media claims.",
              "",
              "EVIDENCE LANGUAGE:",
              "- Use 'established' only when evidence is strong and well-supported.",
              "- Use 'evidence suggests' when evidence is promising but incomplete.",
              "- Use 'preliminary' when research is early-stage.",
              "- Use 'unsupported' when the provided evidence does not substantiate a claim.",
              "- Use 'unknown' when the available sources cannot establish the answer.",
              "",
              "IMPORTANT:",
              "Do not manufacture certainty.",
              "Scientific accuracy is more important than producing an impressive answer.",
            ].join("\n"),
          },
          {
            role: "user",
            content: [
              `Research question:
${request.question}`,
              "",
              "Research gaps identified:",
              "",
              gapAnalysis.gaps.length > 0
                ? gapAnalysis.gaps
                    .map(
                      (gap, index) =>
                        `${index + 1}. ${gap.claim}
Problem: ${gap.problem}
Priority: ${gap.priority}
Search queries: ${gap.searchQueries.join(", ")}`
                    )
                    .join("\n\n")
                : "No significant research gaps were detected.",
              "",
              "Collected evidence:",
              "",
              researchContext,
              "",
              "Produce the final rigorous scientific synthesis.",
            ].join("\n"),
          },
        ],
        temperature: 0.2,
      });

    return {
      question: request.question,
      status: "completed",
      summary: response.content,
      sources: finalSources.map(
        (source) => ({
          title: source.title,
          url: source.url,
          snippet: source.snippet,
          evaluation: source.evaluation,
        })
      ),
    };
  }

  private buildInitialQueries(
    question: string
  ): string[] {
    return [
      question,
      `${question} scientific evidence`,
      `${question} primary research peer reviewed`,
    ];
  }

  private async executeSearch(
    query: string,
    researchCapability: {
      execute(
        input: unknown
      ): Promise<unknown>;
    },
    sources: Map<
      string,
      ResearchSource
    >,
    sourceLimit: number
  ): Promise<void> {
    try {
      const searchResult =
        (await researchCapability.execute({
          question: query,
        })) as CapabilityResearchResult;

      if (
        !searchResult?.sources?.length
      ) {
        console.log(
          `[Researcher] No results for query: ${query}`
        );

        return;
      }

      for (const result of searchResult.sources) {
        if (!result?.url) {
          continue;
        }

        const normalizedUrl =
          this.normalizeUrl(
            result.url
          );

        if (
          !sources.has(
            normalizedUrl
          )
        ) {
          sources.set(
            normalizedUrl,
            {
              title:
                result.title ??
                "Untitled source",

              url:
                result.url,

              snippet:
                result.snippet ??
                "",
            }
          );
        }

        if (
          sources.size >=
          sourceLimit
        ) {
          break;
        }
      }
    } catch (error) {
      console.error(
        `[Researcher] Search failed: ${query}`,
        error
      );
    }
  }

  private async evaluateSources(
    sourceList: ResearchSource[],
    sourceEvaluator: SourceEvaluator,
    question: string
  ): Promise<void> {
    for (const source of sourceList) {
      console.log(
        `[Researcher] Evaluating: ${source.title}`
      );

      try {
        source.evaluation =
          await sourceEvaluator.evaluate(
            source,
            question
          );
      } catch (error) {
        console.error(
          `[Researcher] Failed to evaluate source: ${source.title}`,
          error
        );
      }
    }
  }

  private rankSources(
    sourceList: ResearchSource[]
  ): void {
    sourceList.sort(
      (a, b) =>
        (b.evaluation?.score ?? 0) -
        (a.evaluation?.score ?? 0)
    );
  }

  private logRanking(
    sources: ResearchSource[],
    label: string
  ): void {
    console.log(
      `[Researcher] ${label}:`
    );

    for (const source of sources) {
      console.log(
        `${source.evaluation?.score ?? 0}/100 - ${source.title}`
      );
    }
  }

  private prioritizeGaps(
    gaps: readonly ResearchGap[]
  ): ResearchGap[] {
    const priorityWeight: Record<
      ResearchGap["priority"],
      number
    > = {
      high: 3,
      medium: 2,
      low: 1,
    };

    return [...gaps]
      .filter(
        (gap) =>
          gap.priority === "high" ||
          gap.priority === "medium"
      )
      .sort(
        (a, b) =>
          priorityWeight[b.priority] -
          priorityWeight[a.priority]
      )
      .slice(
        0,
        MAX_GAP_SEARCHES
      );
  }

  private async executeGapResearch(
    gap: ResearchGap,
    researchCapability: {
      execute(
        input: unknown
      ): Promise<unknown>;
    },
    sources: Map<
      string,
      ResearchSource
    >
  ): Promise<void> {
    const queries =
      gap.searchQueries.slice(
        0,
        MAX_QUERIES_PER_GAP
      );

    for (const query of queries) {
      if (
        sources.size >=
        MAX_TOTAL_SOURCES
      ) {
        return;
      }

      console.log(
        `[Researcher] Targeted research: ${query}`
      );

      await this.executeSearch(
        query,
        researchCapability,
        sources,
        MAX_TOTAL_SOURCES
      );

      console.log(
        `[Researcher] Sources after targeted search: ${sources.size}`
      );
    }
  }

  private buildResearchContext(
    sources: ResearchSource[]
  ): string {
    return sources
      .map(
        (source, index) =>
          [
            `Source ${index + 1}`,
            `Title: ${source.title}`,
            `URL: ${source.url}`,
            `Content: ${source.snippet}`,
            "",
            "Evaluation:",
            `Score: ${source.evaluation?.score ?? "unknown"}/100`,
            `Type: ${source.evaluation?.sourceType ?? "unknown"}`,
            `Credibility: ${source.evaluation?.credibility ?? "unknown"}/100`,
            `Relevance: ${source.evaluation?.relevance ?? "unknown"}/100`,
            `Evidence quality: ${source.evaluation?.evidenceQuality ?? "unknown"}/100`,
            `Recency: ${source.evaluation?.recency ?? "unknown"}/100`,
            `Reasoning: ${source.evaluation?.reasoning ?? "unknown"}`,
          ].join("\n")
      )
      .join("\n\n");
  }

  private normalizeUrl(
    url: string
  ): string {
    return url
      .trim()
      .toLowerCase()
      .replace(/\/$/, "");
  }

  async shutdown(): Promise<void> {
    this.context = null;
  }
}
