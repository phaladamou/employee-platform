import type { ArxivPaper, ArxivSearchResponse } from "./arxiv-types";

export class ArxivClient {
  private readonly baseUrl = "https://export.arxiv.org/api/query";

  async search(
    query: string,
    maxResults: number = 10
  ): Promise<ArxivSearchResponse> {
    const params = new URLSearchParams({
      search_query: `all:${query}`,
      start: "0",
      max_results: maxResults.toString(),
      sortBy: "relevance",
      sortOrder: "descending"
    });

    const response = await fetch(`${this.baseUrl}?${params}`);
    
    if (!response.ok) {
      throw new Error(`arXiv API error: ${response.status}`);
    }

    const xml = await response.text();
    return this.parseArxivResponse(xml);
  }

  private parseArxivResponse(xml: string): ArxivSearchResponse {
    const papers: ArxivPaper[] = [];
    
    // Parser les entrées XML
    const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
    
    for (const entry of entries) {
      const paper = this.parseEntry(entry);
      if (paper) {
        papers.push(paper);
      }
    }
    
    // Extraire le nombre total de résultats
    const totalMatch = xml.match(/<opensearch:totalResults[^>]*>(\d+)<\/opensearch:totalResults>/);
    const totalResults = totalMatch ? parseInt(totalMatch[1]) : papers.length;
    
    return {
      papers,
      totalResults
    };
  }

  private parseEntry(entry: string): ArxivPaper | null {
    try {
      const id = this.extractText(entry, "id") ?? "";
      const title = this.extractText(entry, "title") ?? "Untitled";
      const summary = this.extractText(entry, "summary") ?? "";
      const published = this.extractText(entry, "published") ?? "";
      const updated = this.extractText(entry, "updated") ?? "";
      const link = this.extractLink(entry);
      const pdfLink = this.extractPdfLink(entry);
      
      // Extraire les auteurs
      const authors = this.extractAuthors(entry);
      
      // Extraire les catégories
      const categories = this.extractCategories(entry);
      
      return {
        id: id.replace("http://arxiv.org/abs/", ""),
        title: this.cleanText(title),
        summary: this.cleanText(summary),
        authors,
        published,
        updated,
        categories,
        link,
        pdfLink
      };
    } catch (error) {
      console.error("Failed to parse arXiv entry:", error);
      return null;
    }
  }

  private extractText(xml: string, tag: string): string | null {
    const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
    return match ? match[1].trim() : null;
  }

  private extractLink(entry: string): string {
    const match = entry.match(/<link[^>]*href="([^"]*)"[^>]*\/?>/);
    return match ? match[1] : "";
  }

  private extractPdfLink(entry: string): string {
    const match = entry.match(/<link[^>]*title="pdf"[^>]*href="([^"]*)"[^>]*\/?>/);
    return match ? match[1] : "";
  }

  private extractAuthors(entry: string): string[] {
    const authors: string[] = [];
    const authorMatches = entry.match(/<author>[\s\S]*?<\/author>/g) ?? [];
    
    for (const authorXml of authorMatches) {
      const name = this.extractText(authorXml, "name");
      if (name) {
        authors.push(this.cleanText(name));
      }
    }
    
    return authors;
  }

  private extractCategories(entry: string): string[] {
    const categories: string[] = [];
    const categoryMatches = entry.match(/<category[^>]*term="([^"]*)"[^>]*\/?>/g) ?? [];
    
    for (const categoryXml of categoryMatches) {
      const term = categoryXml.match(/term="([^"]*)"/);
      if (term) {
        categories.push(term[1]);
      }
    }
    
    return categories;
  }

  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, " ")
      .replace(/\n/g, " ")
      .trim();
  }
}