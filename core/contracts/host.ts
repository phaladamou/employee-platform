/**
 * CoreHost
 *
 * Le pont entre le Core et l'application.
 * L'application implémente cette interface.
 * Le Core ne connaît QUE cette interface.
 *
 * Le Core peut :
 * - demander l'historique
 * - demander d'autres conversations
 * - demander des documents
 * - demander sa mémoire
 * - déclencher des actions sur les environnements
 */

export type HostMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  parts: readonly unknown[];
  createdAt: Date;
};

export type HostConversation = {
  id: string;
  title: string;
  createdAt: Date;
};

export type HostSearchResult = {
  title: string;
  snippet: string;
  url: string;
  image?: string;
};

export type HostWeather = {
  location: string;
  temperature: number;
  condition: string;
};

export type HostNewsResult = {
  title: string;
  snippet: string;
  url: string;
  publishedAt?: string;
};

export type HostDocument = {
  id: string;
  title: string;
  kind: "text" | "code" | "sheet" | "site";
  content: string;
};

export type HostDocumentInput = {
  title: string;
  kind: "text" | "code" | "sheet" | "site";
  content?: string;
};

export type HostDocumentResult = {
  id: string;
  title: string;
  kind: "text" | "code" | "sheet" | "site";
};

export type HostMemory = {
  id: string;
  userId: string;
  type: "working" | "episodic" | "semantic" | "summary" | "execution";
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
};

export interface CoreHost {
  // === Lecture de l'historique ===
  getConversation(chatId: string): Promise<HostMessage[]>;
  getUserConversations(userId: string): Promise<HostConversation[]>;
  searchConversations(
    query: string,
    userId: string
  ): Promise<HostConversation[]>;

  // === Documents ===
  getDocument(id: string): Promise<HostDocument | null>;
  createDocument(input: HostDocumentInput): Promise<HostDocumentResult>;
  updateDocument(id: string, content: string): Promise<HostDocumentResult>;
  editDocument(id: string, changes: string): Promise<HostDocumentResult>;

  // === APIs externes ===
  searchWeb(query: string): Promise<HostSearchResult[]>;
  getWeather(location: string): Promise<HostWeather>;
  newsSearch(query: string): Promise<HostNewsResult[]>;

  // === Mémoire d'Employee ===
  saveMemory(memory: Omit<HostMemory, "id" | "createdAt">): Promise<void>;
  getMemories(userId: string, query?: string): Promise<HostMemory[]>;
  searchMemory(userId: string, query: string): Promise<HostMemory[]>;
}