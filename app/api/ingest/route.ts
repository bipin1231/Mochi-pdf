import { NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
import { embedAuto, errMsg } from "@/lib/llm";
import { chunkPages, docs } from "@/lib/rag";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const file = (await req.formData()).get("file");
  if (!(file instanceof File) || file.type !== "application/pdf")
    return NextResponse.json({ error: "Please upload a PDF." }, { status: 400 });
  if (file.size > 20_000_000)
    return NextResponse.json({ error: "PDF is over 20 MB." }, { status: 413 });

  try {
    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
    const { text } = await extractText(pdf, { mergePages: false });
    const parts = chunkPages(text);
    if (!parts.length)
      return NextResponse.json({ error: "No selectable text found. Scanned PDFs need OCR." }, { status: 422 });

    const { embedder, vecs } = await embedAuto(parts.map((p) => p.text));
    const docId = crypto.randomUUID();
    docs.set(docId, { name: file.name, embedder, chunks: parts.map((p, i) => ({ ...p, vec: vecs[i] })) });
    return NextResponse.json({ docId, name: file.name, pages: text.length });
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}
