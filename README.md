# Mochi PDF

Mochi is a playful, keyboard-inspired PDF reader with a built-in AI chat. Upload a document, ask questions in natural language, and get answers grounded in relevant excerpts with page citations.

## Features

- Upload and read PDFs in the browser, with a 2 MB upload limit.
- Extract selectable PDF text, split it into overlapping chunks, and search those chunks by semantic similarity.
- Ask questions about a document and receive streamed answers with citations to retrieved pages.
- Use OpenRouter, Google Gemini, or Anthropic for chat generation. Providers are selected automatically based on configured API keys.
- Use OpenRouter or Gemini for document and query embeddings.
- Enjoy a custom Mochi interface with an on-screen keyboard, sound effects, color themes, and citation navigation.

> **PDF support:** Scanned documents without selectable text are not supported; OCR is not currently included.

## Getting started

### Requirements

- Node.js and npm
- An API key for at least one supported embedding provider (OpenRouter or Gemini)
- An API key for at least one supported chat provider (OpenRouter, Gemini, or Anthropic)

OpenRouter and Gemini can each provide both embeddings and chat. If you use Anthropic for chat, you must also configure OpenRouter or Gemini for embeddings.

### Install and run

```bash
git clone https://github.com/bipin1231/Mochi-pdf.git
cd mochi-pdf
npm install
cp .env.example .env.local
```

Add your API keys to `.env.local`, then start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Configuration

Set at least one chat API key and one embedding API key in `.env.local`:

| Variable | Required | Description |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | Optional | Enables OpenRouter chat and embeddings. |
| `GEMINI_API_KEY` | Optional | Enables Gemini chat and embeddings. `GOOGLE_API_KEY` is also accepted as a fallback. |
| `ANTHROPIC_API_KEY` | Optional | Enables Anthropic chat; it does not provide embeddings in this app. |
| `OPENROUTER_MODEL` | Optional | OpenRouter chat model. Defaults to `openai/gpt-4o`. |
| `OPENROUTER_EMBED_MODEL` | Optional | OpenRouter embedding model. Defaults to `openai/text-embedding-3-small`. |
| `GEMINI_MODEL` | Optional | Gemini chat model. Defaults to `gemini-2.5-flash`. |
| `CLAUDE_MODEL` | Optional | Anthropic chat model. Defaults to `claude-sonnet-5-5`. |
| `APP_URL` | Optional | Application URL sent as OpenRouter request metadata. Defaults to `http://localhost:3000`. |

When multiple chat providers are configured, Mochi tries them in this order: OpenRouter, Gemini, then Anthropic. It falls back to another provider only if the current provider errors before producing any answer text. Embedding providers are tried in OpenRouter-then-Gemini order. A document is queried using the same embedding provider that indexed it.

See [`.env.example`](./.env.example) for a copyable template. Keep API keys in `.env.local` and never commit them.

## How it works

1. The ingestion API accepts a PDF, extracts its text, and divides it into page-aware chunks.
2. Mochi creates vector embeddings for those chunks and keeps the indexed document in server memory.
3. For each question, Mochi embeds the query, retrieves the five most similar chunks, and sends those excerpts to the selected chat provider.
4. The answer is streamed to the interface with page citations linked to the PDF reader.

The current document store is **in-memory**. Uploaded documents are not persisted across server restarts and may not be available across multiple server instances. For a production deployment, replace the in-memory store with persistent, shared storage.

## API routes

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/ingest` | `POST` | Accepts a PDF as the `file` multipart form field, extracts and indexes its text, and returns a document ID. |
| `/api/chat` | `POST` | Accepts a document ID, question, and optional conversation history; streams an answer grounded in retrieved excerpts. |

Uploads must be PDFs no larger than 2 MB. The ingestion route returns an error if a PDF has no selectable text.

## Development

```bash
npm run dev    # Start the Next.js development server
npm run build  # Create a production build
npm run start  # Serve the production build
```

## Project structure

```text
app/
  api/
    chat/       # Retrieval-grounded streaming chat endpoint
    ingest/     # PDF extraction and indexing endpoint
  globals.css   # Application styles
  layout.tsx    # Root layout and metadata
  page.tsx      # Application entry page
components/     # Chat interface, on-screen keyboard, and Mochi character
lib/
  llm.ts        # Chat provider and embedding integrations
  rag.ts        # Chunking, in-memory document store, and retrieval
  sound.ts      # Synthesized interface sound effects
public/         # Texture assets
```
