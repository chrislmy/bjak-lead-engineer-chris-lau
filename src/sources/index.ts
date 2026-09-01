import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import * as cv from "./cv.ts";
import * as linkedin from "./linkedin.ts";
import {
  emptyMarkdownDir,
  knowledgeDir,
  manifestPath,
  parseDocument,
  renderManifest,
  sourcedKnowledgeDir,
  type KnowledgeDocument,
} from "./io.ts";

// Source modules registered for ingest and retrieve.
const sources = [cv, linkedin];

const GENERATED_BANNER = "<!-- Written by ingest. -->\n\n";

export async function ingestAll(): Promise<string[]> {
  await mkdir(knowledgeDir, { recursive: true });
  const docs: KnowledgeDocument[] = [];
  const written: string[] = [];
  for (const source of sources) {
    const dir = sourcedKnowledgeDir(source.id);
    await mkdir(dir, { recursive: true });
    await emptyMarkdownDir(dir);
    const chunks = await source.ingest();
    for (const chunk of chunks) {
      const file = path.join(dir, chunk.fileName);
      const markdown = GENERATED_BANNER + chunk.markdown;
      await writeFile(file, markdown, "utf8");
      docs.push(parseDocument(markdown, file));
      written.push(file);
    }
  }
  await writeFile(manifestPath, renderManifest(docs), "utf8");
  written.push(manifestPath);
  return written;
}

export { cv, linkedin, manifestPath };
