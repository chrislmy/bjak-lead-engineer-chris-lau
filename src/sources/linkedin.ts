import { ingestFixture, retrieveSource } from "./io.ts";

export const id = "linkedin";
export const origin = "fixtures/linkedin.md";

export async function ingest() {
  return ingestFixture(id, origin, "whole");
}

export async function retrieve(): Promise<string> {
  return retrieveSource(id);
}
