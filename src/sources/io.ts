import { readdir, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const rootDir = path.resolve(
  fileURLToPath(new URL("../..", import.meta.url)),
);
export const knowledgeDir = path.join(rootDir, "knowledge");
export const manifestPath = path.join(knowledgeDir, "MANIFEST.md");

export type ChunkStrategy = "whole" | "section";

export type SourceMeta = {
  id: string;
  source: string;
  origin: string;
  title?: string;
};

export type KnowledgeDocument = {
  meta: SourceMeta;
  body: string;
  file: string;
};

export type IngestChunk = {
  fileName: string;
  markdown: string;
};

export function sourcedKnowledgeDir(id: string): string {
  return path.join(knowledgeDir, id);
}

export function slug(text: string): string {
  const value = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return value.length > 0 ? value : "section";
}

export function splitBySection(
  markdown: string,
): Array<{ title: string; slug: string; text: string }> {
  if (!/^##\s+/m.test(markdown)) {
    return [];
  }
  return markdown
    .split(/^##\s+/m)
    .slice(1)
    .map((section) => {
      const newline = section.indexOf("\n");
      const title = (newline < 0 ? section : section.slice(0, newline)).trim();
      const body = newline < 0 ? "" : section.slice(newline + 1).trim();
      return {
        title,
        slug: slug(title),
        text:
          body.length > 0 ? `## ${title}\n\n${body}\n` : `## ${title}\n`,
      };
    })
    .filter((chunk) => chunk.title.length > 0);
}

export function wrapSource(meta: SourceMeta, body: string): string {
  const lines = [
    "---",
    `id: ${meta.id}`,
    `source: ${meta.source}`,
    `origin: ${meta.origin}`,
  ];
  if (meta.title !== undefined && meta.title.length > 0) {
    lines.push(`title: ${meta.title}`);
  }
  lines.push("---");
  return `${lines.join("\n")}\n${body.trimEnd()}\n`;
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/m;

function parseMeta(header: string): SourceMeta {
  const required = (key: string): string => {
    const match = header.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
    const value = match?.[1]?.trim();
    if (!value) {
      throw new Error(`Frontmatter missing "${key}"`);
    }
    return value;
  };
  const optional = (key: string): string | undefined => {
    const match = header.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
    return match?.[1]?.trim();
  };
  return {
    id: required("id"),
    source: required("source"),
    origin: required("origin"),
    title: optional("title"),
  };
}

export function parseDocument(
  markdown: string,
  file: string,
): KnowledgeDocument {
  const match = markdown.match(FRONTMATTER);
  const header = match?.[1];
  if (match === null || header === undefined || match.index === undefined) {
    throw new Error(`No frontmatter in ${file}. Run ingest first.`);
  }
  return {
    meta: parseMeta(header),
    body: markdown
      .slice(match.index + match[0].length)
      .replace(/^\r?\n/, "")
      .trimEnd(),
    file,
  };
}

export function renderManifest(docs: KnowledgeDocument[]): string {
  const rows = docs
    .map((doc) => {
      const relative = path.relative(rootDir, doc.file);
      const title = doc.meta.title ?? "";
      return `| \`${doc.meta.id}\` | ${doc.meta.source} | ${title} | \`${doc.meta.origin}\` | \`${relative}\` |`;
    })
    .join("\n");
  return `# Knowledge Manifest

Produced by \`npx tsx src/cli.ts ingest\`. Rows are the files \`ask\` can load.

| id | source | title | origin | file |
| --- | --- | --- | --- | --- |
${rows}
`;
}

function isEnoent(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

export async function emptyMarkdownDir(dir: string): Promise<void> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch (error) {
    if (isEnoent(error)) {
      return;
    }
    throw error;
  }
  await Promise.all(
    names
      .filter((name) => name.endsWith(".md"))
      .map((name) => unlink(path.join(dir, name))),
  );
}

export async function ingestFixture(
  id: string,
  origin: string,
  strategy: ChunkStrategy,
): Promise<IngestChunk[]> {
  const raw = await readFile(path.join(rootDir, origin), "utf8");
  const sections = strategy === "section" ? splitBySection(raw) : [];
  const chunks =
    sections.length > 0
      ? sections
      : [{ title: id, slug: id, text: `${raw.trimEnd()}\n` }];
  return chunks.map((chunk) => {
    const chunkId =
      sections.length > 0 ? `${id}#${chunk.slug}` : id;
    return {
      fileName: `${chunk.slug}.md`,
      markdown: wrapSource(
        {
          id: chunkId,
          source: id,
          origin,
          title: chunk.title,
        },
        chunk.text,
      ),
    };
  });
}

export class KnowledgeMissingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KnowledgeMissingError";
  }
}

export async function retrieveSource(id: string): Promise<string> {
  const dir = sourcedKnowledgeDir(id);
  let names: string[];
  try {
    names = (await readdir(dir)).filter((name) => name.endsWith(".md"));
  } catch (error) {
    if (isEnoent(error)) {
      throw new KnowledgeMissingError(
        `Missing ${dir}. Run \`npx tsx src/cli.ts ingest\` first.`,
      );
    }
    throw error;
  }
  if (names.length === 0) {
    throw new KnowledgeMissingError(
      `No documents in ${dir}. Run \`npx tsx src/cli.ts ingest\` first.`,
    );
  }
  const docs = await Promise.all(
    names.map(async (name) => {
      const file = path.join(dir, name);
      return parseDocument(await readFile(file, "utf8"), file);
    }),
  );
  return docs.map((doc) => doc.body).join("\n");
}
