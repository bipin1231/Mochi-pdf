import { embed, type Embedder } from "./llm";

export type Chunk = { text: string; page: number; vec: number[] };
type Doc = { name: string; embedder: Embedder; chunks: Chunk[] };

// In-memory store. Survives dev HMR; swap for pgvector/Pinecone in production.
const g = globalThis as unknown as { __docs?: Map<string, Doc> };
export const docs = (g.__docs ??= new Map<string, Doc>());

export function chunkPages(pages: string[], size = 900, overlap = 150) {
  const out: { text: string; page: number }[] = [];
  pages.forEach((raw, i) => {
    const t = raw.replace(/\s+/g, " ").trim();
    for (let s = 0; s < t.length; s += size - overlap) {
      const c = t.slice(s, s + size);
      if (c.length > 40) out.push({ text: c, page: i + 1 });
      if (s + size >= t.length) break;
    }
  });
  return out;
}

// Vectors are unit length, so dot product equals cosine similarity.
const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);

// Queries must use the same embedder the document was indexed with.
export async function retrieve(docId: string, query: string, k = 5) {
  const doc = docs.get(docId);
  if (!doc) return null;
  const [q] = await embed([query], doc.embedder, "query");
  return doc.chunks
    .map((c) => ({ c, score: dot(q, c.vec) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((x) => x.c);
}
