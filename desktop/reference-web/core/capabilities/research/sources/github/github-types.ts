export interface GithubRepository {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  htmlUrl: string;
  stars: number;
  forks: number;
  language: string | null;
  topics: string[];
  updatedAt: string;
}

export interface GithubSearchResponse {
  repositories: GithubRepository[];
  totalCount: number;
}

export interface GithubReadme {
  content: string;
  encoding: string;
  size: number;
}

export interface GithubFile {
  name: string;
  path: string;
  content: string;
  size: number;
}