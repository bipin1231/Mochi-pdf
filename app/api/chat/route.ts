import { errMsg, generate, type Turn } from "@/lib/llm";
import { retrieve } from "@/lib/rag";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { docId, question, history = [] } = (await req.json()) as {
    docId: string; question: string; history?: Turn[];
  };

  let ctx;
  try { ctx = await retrieve(docId, question); }
  catch (e) { return new Response(errMsg(e), { status: 500 }); }
  if (!ctx) return new Response("Document not found. Upload it again.", { status: 404 });

  const context = ctx.map((c, i) => `[${i + 1}] (page ${c.page})\n${c.text}`).join("\n\n");
  const system =
    "Answer using only the PDF excerpts below. Cite sources as (p.N) with exactly one page per citation, " +
    "for example (p.3) (p.5). Only cite pages that appear in an excerpt header below. " +
    "Never cite page ranges or pages you were not given. " +
    "If the excerpts do not contain the answer, say so plainly.\n\n" + context;
  const sources = [...new Map(ctx.map((c) => [c.page, { page: c.page, snippet: c.text.slice(0, 120) }])).values()];

  const enc = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      // First line is JSON sources, the rest is the streamed answer.
      controller.enqueue(enc.encode(JSON.stringify(sources) + "\n"));
      try {
        for await (const t of generate(system, [...history.slice(-6), { role: "user", content: question }]))
          controller.enqueue(enc.encode(t));
      } catch (e) { controller.enqueue(enc.encode("\n\n" + errMsg(e))); }
      controller.close();
    },
  });
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
