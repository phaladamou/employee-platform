import type { 
  GithubRepository, 
  GithubSearchResponse, 
  GithubReadme 
} from "./github-types";

export class GithubClient {
  private readonly baseUrl = "https://api.github.com";
  private readonly token: string | null;

  constructor(token?: string) {
    this.token = token ?? null;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Accept": "application/vnd.github.v3+json"
    };

    if (this.token) {
      headers["Authorization"] = `token ${this.token}`;
    }

    return headers;
  }

  async searchRepositories(
    query: string,
    limit: number = 10
  ): Promise<GithubSearchResponse> {
    const params = new URLSearchParams({
      q: query,
      sort: "stars",
      order: "desc",
      per_page: limit.toString()
    });

    const response = await fetch(
      `${this.baseUrl}/search/repositories?${params}`,
      { headers: this.getHeaders() }
    );

    // Gérer le rate limiting GitHub
    if (response.status === 403) {
      const rateLimit = response.headers.get("x-ratelimit-remaining");
      if (rateLimit === "0") {
        const resetTime = response.headers.get("x-ratelimit-reset");
        const resetDate = resetTime 
          ? new Date(parseInt(resetTime) * 1000).toLocaleString()
          : "unknown time";
        
        throw new Error(`GitHub API rate limit exceeded. Resets at: ${resetDate}`);
      }
    }

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();
    
    return {
      repositories: data.items.map((item: any) => ({
        id: item.id,
        name: item.name,
        fullName: item.full_name,
        description: item.description,
        htmlUrl: item.html_url,
        stars: item.stargazers_count,
        forks: item.forks_count,
        language: item.language,
        topics: item.topics ?? [],
        updatedAt: item.updated_at
      })),
      totalCount: data.total_count
    };
  }

  async getReadme(fullName: string): Promise<string | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/repos/${fullName}/readme`,
        { headers: this.getHeaders() }
      );

      // Gérer le rate limiting
      if (response.status === 403) {
        const rateLimit = response.headers.get("x-ratelimit-remaining");
        if (rateLimit === "0") {
          console.warn("GitHub API rate limit exceeded for README fetch");
          return null;
        }
      }

      if (!response.ok) {
        return null;
      }

      const data: GithubReadme = await response.json();
      
      // Décoder le contenu base64
      return Buffer.from(data.content, "base64").toString("utf-8");
    } catch (error) {
      console.error(`Failed to fetch README for ${fullName}:`, error);
      return null;
    }
  }
}