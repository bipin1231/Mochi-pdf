import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";

export type Provider = "openrouter" | "gemini" | "anthropic";
export type Embedder = "openrouter" | "gemini";
export type Turn = { role: "user" | "assistant"; content: string };

const keys: Record<Provider, () => string | undefined> = {
  openrouter: () => process.env.OPENROUTER_API_KEY,
  gemini: () => process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY,
  anthropic: () => process.env.ANTHROPIC_API_KEY,
};

// The backend decides: first provider with a key wins, the rest are automatic fallbacks.
const ORDER: Provider[] = ["openrouter", "gemini", "anthropic"];
const available = () => ORDER.filter((p) => keys[p]());
const embedders = () => (["openrouter", "gemini"] as Embedder[]).filter((p) => keys[p]());

const router = () => new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: keys.openrouter(),
  defaultHeaders: { "HTTP-Referer": process.env.APP_URL ?? "http://localhost:3000", "X-Title": "Mochi" },
});
const genai = () => new GoogleGenAI({ apiKey: keys.gemini() });
const norm = (v: number[]) => { const n = Math.hypot(...v) || 1; return v.map((x) => x / n); };

export async function embed(texts: string[], who: Embedder, kind: "doc" | "query"): Promise<number[][]> {
  const out: number[][] = [];
  if (who === "openrouter") {
    for (let i = 0; i < texts.length; i += 96) {
      const r = await router().embeddings.create({
        model: process.env.OPENROUTER_EMBED_MODEL ?? "openai/text-embedding-3-small",
        input: texts.slice(i, i + 96), encoding_format: "float",
      });
      out.push(...r.data.map((d) => norm(d.embedding)));
    }
    return out;
  }
  for (let i = 0; i < texts.length; i += 100) {
    const r = await genai().models.embedContent({
      model: "gemini-embedding-001",
      contents: texts.slice(i, i + 100),
      config: { taskType: kind === "doc" ? "RETRIEVAL_DOCUMENT" : "RETRIEVAL_QUERY", outputDimensionality: 768 },
    });
    out.push(...(r.embeddings ?? []).map((e) => norm(e.values ?? [])));
  }
  return out;
}

// Index with the first working embedder. The document remembers which one, so queries match.
export async function embedAuto(texts: string[]) {
  const list = embedders();
  if (!list.length) throw new Error("Set OPENROUTER_API_KEY or GEMINI_API_KEY in .env.local (Claude has no embedding model).");
  let last: unknown;
  for (const embedder of list) {
    try { return { embedder, vecs: await embed(texts, embedder, "doc") }; } catch (e) { last = e; }
  }
  throw last;
}

async function* one(p: Provider, system: string, messages: Turn[]): AsyncGenerator<string> {
  if (p === "openrouter") {
    const s = await router().chat.completions.create({
      model: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o",
      stream: true, max_tokens: 1024,
      messages: [{ role: "system", content: system }, ...messages],
    });
    for await (const c of s) { const t = c.choices[0]?.delta?.content; if (t) yield t; }
  } else if (p === "gemini") {
    const s = await genai().models.generateContentStream({
      model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
      contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      config: { systemInstruction: system },
    });
    for await (const c of s) if (c.text) yield c.text;
  } else {
    const s = new Anthropic().messages.stream({ model: process.env.CLAUDE_MODEL ?? "claude-sonnet-5-5", max_tokens: 1024, system, messages });
    for await (const ev of s) if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") yield ev.delta.text;
  }
}

// Fails over to the next provider only if the current one errors before sending any text.
export async function* generate(system: string, messages: Turn[]): AsyncGenerator<string> {
  const order = available();
  if (!order.length) throw new Error("No API key found. Add OPENROUTER_API_KEY (or GEMINI_API_KEY) to .env.local.");
  let last: unknown;
  for (const p of order) {
    let started = false;
    try { for await (const t of one(p, system, messages)) { started = true; yield t; } return; }
    catch (e) { last = e; if (started) throw e; }
  }
  throw last;
}

export const errMsg = (e: unknown) => (e instanceof Error && e.message ? e.message : "Something went wrong.");
