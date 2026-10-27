export interface ArxivPaper {
  id: string;
  title: string;
  summary: string;
  authors: string[];
  published: string;
  updated: string;
  categories: string[];
  link: string;
  pdfLink: string;
}

export interface ArxivSearchResponse {
  papers: ArxivPaper[];
  totalResults: number;
}