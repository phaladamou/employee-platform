// lib/engineering/files.ts
// Helpers purs pour l'IDE Engineering (arbre + langage).
// Sans dependance Next/React, testables via node --test.

export interface WorkspaceFileEntry {
  path: string;
  size: number;
  updatedAt?: string;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: FileTreeNode[];
}

export interface ActivityEntry {
  ts: string;
  tool: string;
  message: string;
  ok: boolean;
}

/**
 * Parse le journal d'activite JSONL ecrit par les outils (une ligne
 * par action). Lignes illisibles ignorees, dernieres `limit` gardees.
 */
export function parseActivityLog(text: string, limit = 20): ActivityEntry[] {
  const out: ActivityEntry[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    try {
      const data = JSON.parse(trimmed) as {
        ts?: unknown;
        tool?: unknown;
        message?: unknown;
        ok?: unknown;
      };
      if (typeof data.message !== "string" || !data.message) {
        continue;
      }
      out.push({
        ts: typeof data.ts === "string" ? data.ts : "",
        tool: typeof data.tool === "string" ? data.tool : "",
        message: data.message,
        ok: data.ok !== false,
      });
    } catch {
      continue;
    }
  }
  return out.slice(-Math.max(1, limit));
}

// Taille max servie par l'API fichier (socle : lecture seule).
export const MAX_FILE_BYTES = 200_000;

// Refuse les echappatoires (.. , absolu, segments vides).
export function isSafeWorkspacePath(value: string): boolean {
  if (!value || value.length > 512) return false;
  if (value.startsWith("/") || value.includes("\\")) return false;
  const parts = value.split("/");
  for (const part of parts) {
    if (!part || part === "." || part === "..") return false;
  }
  return true;
}

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  mjs: "javascript",
  cjs: "javascript",
  json: "json",
  py: "python",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  md: "markdown",
  mdx: "mdx",
  yml: "yaml",
  yaml: "yaml",
  toml: "toml",
  css: "css",
  html: "html",
  sql: "sql",
  rs: "rust",
  go: "go",
  dockerfile: "dockerfile",
  env: "dotenv",
  txt: "text",
};

export function languageForPath(path: string): string {
  const base = path.split("/").pop() ?? path;
  if (base === "Dockerfile") return "dockerfile";
  const dot = base.lastIndexOf(".");
  if (dot === -1) return "text";
  const ext = base.slice(dot + 1).toLowerCase();
  return LANGUAGE_BY_EXTENSION[ext] ?? "text";
}

// Construit un arbre trie (dossiers d'abord) depuis des chemins plats.
export function buildFileTree(
  entries: Array<string | WorkspaceFileEntry>
): FileTreeNode[] {
  const root: FileTreeNode[] = [];
  const paths = entries
    .map((entry) => (typeof entry === "string" ? entry : entry.path))
    .filter((p) => isSafeWorkspacePath(p))
    .sort((a, b) => a.localeCompare(b));

  for (const fullPath of paths) {
    const parts = fullPath.split("/");
    let level = root;
    let current = "";
    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i];
      current = current ? `${current}/${part}` : part;
      const isFile = i === parts.length - 1;
      let node = level.find((n) => n.name === part);
      if (!node) {
        node = isFile
          ? { name: part, path: current, type: "file" }
          : { name: part, path: current, type: "dir", children: [] };
        level.push(node);
      }
      if (!isFile) {
        node.children = node.children ?? [];
        level = node.children;
      }
    }
  }

  const sortNodes = (nodes: FileTreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const node of nodes) {
      if (node.children) sortNodes(node.children);
    }
  };
  sortNodes(root);
  return root;
}
