"use client";
import { Fragment, useEffect, useRef, useState } from "react";
import Mochi from "./Mochi";
import { sfx } from "@/lib/sound";

import Keyboard from "./Keyboard";

type Src = { page: number; snippet: string };
type Msg = { role: "user" | "assistant"; content: string; sources?: Src[] };
type Doc = { docId: string; name: string; pages: number; url: string };
type Piece = { id: number; x: number; y: number; r: number; c: string; s: number };

const STARTERS: [string, string][] = [["summarize it", "Summarize this document"], ["key points", "What are the key takeaways?"], ["dates and numbers", "List every date and number mentioned"]];
const PHRASES = ["boop!", "hehe, that tickles", "I’m reading, I promise", "ask me stuff!"];
const SHELLS: [string, string, string][] = [["lavender", "#cbbcf3", "Lavender"], ["yellow", "#f3cf4a", "Yellow"], ["offwhite", "#e9e5db", "Off-white"], ["graphite", "#3a3d45", "Graphite"]];
const CONFETTI = ["#ff9ec4", "#b7a3ec", "#7cc4f2", "#ffd978", "#ffc2da"];

const Icon = ({ d, size = 18 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>
);
const I = {
  clip: "M21 11l-8.5 8.5a5 5 0 01-7-7L14 4a3.5 3.5 0 015 5l-8.5 8.5a2 2 0 01-3-3L15 7",
  up: "M12 19V5M5 12l7-7 7 7",
  keys: "M3 7h18v10H3zM7 11h.01M11 11h.01M15 11h.01M8 14h8",
  upload: "M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3",
  l: "M15 6l-6 6 6 6", r: "M9 6l6 6-6 6", u: "M6 15l6-6 6 6", d: "M6 9l6 6 6-6",
};

// Matches (p.3), (pp. 1-3), (p.1, p.3), (pages 2 and 4).
const CITE = /(\((?:pp?\.|pages?)\s*\d[^()]*\))/gi;
const IS_CITE = /^\((?:pp?\.|pages?)\s*\d/i;
function pagesOf(s: string): number[] {
  const n = [...s.matchAll(/\d+/g)].map((m) => +m[0]);
  if (n.length === 2 && /\d\s*[–-]\s*\d/.test(s) && n[1] > n[0] && n[1] - n[0] < 50)
    return Array.from({ length: n[1] - n[0] + 1 }, (_, i) => n[0] + i);
  return n;
}

// Every cited page becomes a chip. Pages the retrieval step never returned are flagged as unverified.
function Rich({ text, onPage, valid }: { text: string; onPage: (n: number) => void; valid: number[] }) {
  return <>{text.split(CITE).map((s, i) => {
    if (!IS_CITE.test(s)) return <Fragment key={i}>{s}</Fragment>;
    return <Fragment key={i}>{pagesOf(s).map((n) => valid.includes(n)
      ? <button key={n} className="ref" onClick={() => onPage(n)}>p.{n}</button>
      : <span key={n} className="ref bad" title="Not in the retrieved excerpts">p.{n}?</span>)}</Fragment>;
  })}</>;
}

// Side crank, like the Playdate: drag it in circles to scroll the screen.
function Crank({ onTurn }: { onTurn: (deg: number) => void }) {
  const [a, setA] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef<number | null>(null);
  const acc = useRef(0);
  const ang = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI;
  };
  return (
    <div ref={ref} className="crank" role="slider" aria-label="Crank: turn to scroll" aria-valuenow={Math.round(a % 360)}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); last.current = ang(e); }}
      onPointerMove={(e) => {
        if (last.current === null) return;
        const now = ang(e);
        let d = now - last.current;
        if (d > 180) d -= 360;
        if (d < -180) d += 360;
        last.current = now; setA((v) => v + d); onTurn(d);
        acc.current += Math.abs(d);
        if (acc.current > 28) { acc.current = 0; sfx.crank(); }
      }}
      onPointerUp={() => { last.current = null; }} onPointerCancel={() => { last.current = null; }}>
      <i className="hub" />
      <i className="arm" style={{ transform: `rotate(${a}deg)` }}><b /></i>
    </div>
  );
}

export default function Chat() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [doc, setDoc] = useState<Doc | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [kb, setKb] = useState(false);
  const [shift, setShift] = useState(false);
  const [bump, setBump] = useState(0);
  const [drag, setDrag] = useState(false);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<"chat" | "pdf">("chat");
  const [talk, setTalk] = useState<string | null>(null);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [soundOn, setSoundOn] = useState(true);
  const [shell, setShell] = useState("lavender");
  const end = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sendRef = useRef<(q?: string) => void>(() => {});

  useEffect(() => setSoundOn(sfx.isOn()), []);
  // The prompt grows with what you type (up to 4 lines) and always shows the end of it.
  useEffect(() => {
    const el = promptRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 92) + "px";
    el.scrollTop = el.scrollHeight;
  }, [input]);
  useEffect(() => { try { const s = localStorage.getItem("mochi-shell"); if (s) setShell(s); } catch {} }, []);
  useEffect(() => { document.documentElement.dataset.shell = shell; try { localStorage.setItem("mochi-shell", shell); } catch {} }, [shell]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, kb]);

  // Physical keyboard fills the input while keyboard mode is on, even when the input isn't focused.
  useEffect(() => {
    if (!kb) return;
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Enter") { e.preventDefault(); sendRef.current(); }
      else if (e.key === "Backspace") { e.preventDefault(); setInput((v) => v.slice(0, -1)); }
      else if (e.key.length === 1) { e.preventDefault(); setInput((v) => (v + e.key).slice(0, 500)); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [kb]);

  const say = (content: string) => setMsgs((m) => [...m, { role: "assistant", content, sources: [] }]);
  const view = (n: number) => { setPage(n); setTab("pdf"); };

  function boop() {
    sfx.boop();
    setBump((b) => b + 1);
    setTalk(PHRASES[Math.floor(Math.random() * PHRASES.length)]);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setTalk(null), 1800);
  }
  function celebrate() {
    sfx.celebrate();
    setPieces(Array.from({ length: 30 }, (_, i) => ({
      id: i, x: Math.round((Math.random() - 0.5) * 560), y: -Math.round(80 + Math.random() * 220),
      r: Math.round(Math.random() * 720 - 360), c: CONFETTI[i % CONFETTI.length], s: i % 3,
    })));
    setTalk("Yum, all read!");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { setPieces([]); setTalk(null); }, 2200);
  }

  async function upload(f: File) {
    setStatus("Reading and indexing"); setBusy(true);
    const fd = new FormData();
    fd.append("file", f);
    try {
      const r = await fetch("/api/ingest", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) return say(j.error ?? "Upload failed.");
      if (doc) URL.revokeObjectURL(doc.url);
      setDoc({ ...j, url: URL.createObjectURL(f) }); setMsgs([]); setPage(1); setBump((b) => b + 1); celebrate();
    } catch { say("Upload failed. Check your API keys."); }
    finally { setStatus(""); setBusy(false); }
  }

  async function send(override?: string) {
    const q = (override ?? input).trim();
    if (!q || busy) return;
    if (!doc) return say("Add a PDF first.");
    setTab("chat");
    const history = msgs.filter((m) => m.role === "user" || m.sources).map(({ role, content }) => ({ role, content }));
    sfx.send();
    setInput(""); setBusy(true); setBump((b) => b + 1);
    setMsgs((m) => [...m, { role: "user", content: q }, { role: "assistant", content: "", sources: [] }]);
    const patch = (p: Partial<Msg>) =>
      setMsgs((m) => { const c = [...m]; c[c.length - 1] = { ...c[c.length - 1], ...p }; return c; });
    try {
      const r = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId: doc.docId, question: q, history }),
      });
      if (!r.ok || !r.body) throw new Error(await r.text());
      const rd = r.body.getReader(), dec = new TextDecoder();
      let buf = "", text = "", got = false;
      for (;;) {
        const { done, value } = await rd.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        if (!got) {
          const i = buf.indexOf("\n");
          if (i < 0) continue;
          const sources: Src[] = JSON.parse(buf.slice(0, i));
          patch({ sources }); if (sources[0]) setPage(sources[0].page); // viewer follows the best source
          buf = buf.slice(i + 1); got = true;
        }
        text += buf; buf = "";
        patch({ content: text });
      }
      sfx.done();
    } catch (e) { patch({ content: e instanceof Error && e.message ? e.message : "Something went wrong. Check your API keys." }); }
    setBusy(false); setBump((b) => b + 1);
  }
  sendRef.current = send;

  const onKey = (k: string) => {
    if (k === "enter") return void send();
    if (k === "shift") return setShift((s) => !s);
    if (k === "back") return setInput((v) => v.slice(0, -1));
    if (k === "space") return setInput((v) => v + " ");
    setInput((v) => (v + (shift ? k.toUpperCase() : k)).slice(0, 500));
    setShift(false);
  };

  const pick = () => fileRef.current?.click();
  const scroll = (dy: number) => mainRef.current?.scrollBy({ top: dy, behavior: "smooth" });
  const flip = (d: number) => doc && setPage((p) => Math.min(doc.pages, Math.max(1, p + d)));
  function toggleSound() {
    const n = !soundOn;
    sfx.setOn(n); setSoundOn(n);
    if (n) sfx.blip();
  }

  return (
    <div className={`app ${kb ? "kb-on" : ""} ${drag ? "drag" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDrag(false); }}
      onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) upload(f); }}>
      <input ref={fileRef} type="file" accept="application/pdf" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />

      <header className="top" role="tablist">
        <button role="tab" aria-selected={tab === "chat"} onClick={() => setTab("chat")}>SCREEN</button>
        <button role="tab" aria-selected={tab === "pdf"} onClick={() => setTab("pdf")}>SHEET</button>
      </header>

      <div className="desk">
        <section className={`sheet ${tab === "pdf" ? "show" : ""}`}>
          {doc ? (
            <>
              <div className="paper"><iframe key={`${doc.docId}-${page}`} src={`${doc.url}#page=${page}&view=FitH&toolbar=0&navpanes=0`} title={doc.name} /></div>
              <div className="sheetbar">
                <b title={doc.name}>{doc.name}</b>
                <div className="pager">
                  <button onClick={() => flip(-1)} aria-label="Previous page">‹</button>
                  <span>{page}/{doc.pages}</span>
                  <button onClick={() => flip(1)} aria-label="Next page">›</button>
                </div>
                <button onClick={pick}>SWAP</button>
              </div>
            </>
          ) : (
            <button className="drop" onClick={pick} disabled={busy}>
              <Icon d={I.upload} size={40} />
              <b>{status ? status.toUpperCase() : "INSERT A PDF"}</b>
              <small>DROP A FILE HERE OR CLICK TO LOAD</small>
            </button>
          )}
        </section>

        <section className={`unit ${tab === "chat" ? "show" : ""}`}>
          <div className="peekwrap">
            <button className="peek" onClick={boop} aria-label="Boop Mochi"><Mochi size={92} think={busy} bump={bump} /></button>
            {talk && <span className="speech" key={talk}>{talk}</span>}
          </div>
          <div className="rig">
          <div className="device">
            <i className="screw s1" /><i className="screw s2" /><i className="screw s3" /><i className="screw s4" />
            <div className="topstrip">
              <i className={`led ${busy ? "on" : ""}`} />
              <span className="etch">MOCHI MC-1</span>
              <span className="grille" />
              <div className="switchwrap">
                <small className={!soundOn ? "on" : ""}>MUTE</small>
                <button className="switch" role="switch" aria-checked={soundOn} aria-label="Sound" onClick={toggleSound}><i /></button>
                <small className={soundOn ? "on" : ""}>SOUND</small>
              </div>
            </div>

            <div className="bezel">
              <div className="screen">
                <div className="status"><span>{doc ? `P.${page}/${doc.pages}` : "MC-1"}</span><span>{busy ? "BUSY ▮▮▯" : "IDLE"}</span></div>
                <main ref={mainRef}>
                  {msgs.length === 0 ? (
                    <div className="empty">
                      <h2>{doc ? `${doc.pages} PAGES LOADED` : "NOTHING LOADED"}</h2>
                      <p>{doc ? "Ask something specific. Answers link to the page." : "Feed the slot on the left to begin."}</p>
                      {doc && <div className="starters">{STARTERS.map(([label, q]) => <button key={label} onClick={() => send(q)}>▸ {label}</button>)}</div>}
                    </div>
                  ) : (
                    <div className="thread">
                      {msgs.map((m, i) => (
                        <article key={i} className={`msg ${m.role === "user" ? "u" : "a"}`}>
                          {m.role === "user" ? (
                            <><small>YOU</small><div className="slab">{m.content}</div></>
                          ) : (
                            <>
                              <small><Mochi size={20} /> MOCHI</small>
                              <div className="text">{m.content ? <Rich text={m.content} onPage={view} valid={(m.sources ?? []).map((x) => x.page)} /> : <span className="dots"><i /><i /><i /></span>}</div>
                              {!!m.sources?.length && m.content && (
                                <div className="cites">
                                  <small>SRC</small>
                                  {m.sources.map((s) => (
                                    <button key={s.page} className={`cite ${s.page === page ? "on" : ""}`} onClick={() => view(s.page)} title={s.snippet}>P{s.page}</button>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                        </article>
                      ))}
                    </div>
                  )}
                  <div ref={end} />
                </main>
                <div className="prompt">
                  <b>&gt;</b>
                  <textarea ref={promptRef} rows={1} value={input} onChange={(e) => setInput(e.target.value)} maxLength={500}
                    inputMode={kb ? "none" : "text"} placeholder={doc ? "type a question" : "load a pdf first"}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
                </div>
              </div>
            </div>

            <div className="controls">
              <div className="dgrp"><div className="dpad" aria-label="Directional pad">
                <button className="up" onClick={() => scroll(-140)} aria-label="Scroll up"><Icon d={I.u} /></button>
                <button className="lf" onClick={() => flip(-1)} aria-label="Previous page"><Icon d={I.l} /></button>
                <button className="rt" onClick={() => flip(1)} aria-label="Next page"><Icon d={I.r} /></button>
                <button className="dn" onClick={() => scroll(140)} aria-label="Scroll down"><Icon d={I.d} /></button>
              </div><small className="legend">◂ PAGE ▸ · ▴ SCROLL ▾</small></div>
              <div className="btns">
                <div className="hw"><i className={`led ${kb ? "on" : ""}`} /><button className="keyhw" aria-pressed={kb} onClick={(e) => { if (!kb) setTimeout(() => sfx.dock(true), 480); else sfx.dock(false); setKb((v) => !v); e.currentTarget.blur(); }}><Icon d={I.keys} /></button><small>KEYS</small></div>
                <div className="hw"><button className="round a" onClick={pick} aria-label="Load PDF"><Icon d={I.clip} /></button><small>LOAD</small></div>
                <div className="hw"><button className="round b" onClick={() => send()} disabled={!input.trim() || busy} aria-label="Send"><Icon d={I.up} size={22} /></button><small>SEND</small></div>
              </div>
            </div>

          </div>

          {/* Slide-out keypad: the screen body slides up over it, like a slider phone. */}
          <div className="tray" inert={!kb}>
            <div className="well"><Keyboard open={kb} shift={shift} onKey={onKey} /></div>
            <div className="lip"><i className={`led link ${kb ? "on" : ""}`} /><span className="etch">KP-1 SLIDE KEYPAD</span><span className="grille" /></div>
          </div>
          <Crank onTurn={(d) => mainRef.current?.scrollBy({ top: d * 2.2 })} />
          </div>
        </section>
      </div>

      {!!pieces.length && (
        <div className="confetti" aria-hidden>
          {pieces.map((p) => (
            <i key={p.id} className={`piece p${p.s}`}
              style={{ "--x": `${p.x}px`, "--y": `${p.y}px`, "--r": `${p.r}deg`, background: p.c } as React.CSSProperties} />
          ))}
        </div>
      )}
      <div className="swatches" role="radiogroup" aria-label="Shell color">
        <small>SHELL</small>
        {SHELLS.map(([id, color, label]) => (
          <button key={id} role="radio" aria-checked={shell === id} aria-label={label} title={label}
            style={{ background: color }} onClick={() => { setShell(id); sfx.blip(); }} />
        ))}
      </div>
      <div className="dropveil">DROP PDF TO LOAD</div>
    </div>
  );
}
