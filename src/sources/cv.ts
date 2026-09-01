import { ingestFixture, retrieveSource } from "./io.ts";

export const id = "cv";
export const origin = "fixtures/cv.md";

export async function ingest() {
  return ingestFixture(id, origin, "section");
}

export async function retrieve(): Promise<string> {
  return retrieveSource(id);
}
