"use client";
import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";

type K = { id: string; span: number; label?: string; kind?: "mod" | "go" | "space"; spacer?: boolean };
const L = (s: string): K[] => s.split("").map((c) => ({ id: c, span: 2, label: c.toUpperCase() }));

// 20-column grid: every row sums to 20, so all rows line up like a real keyboard.
const ROWS: K[][] = [
  L("qwertyuiop"),
  [{ id: "_l", span: 1, spacer: true }, ...L("asdfghjkl"), { id: "_r", span: 1, spacer: true }],
  [{ id: "shift", span: 3, label: "SHIFT", kind: "mod" }, ...L("zxcvbnm"), { id: "back", span: 3, label: "DEL", kind: "mod" }],
  [{ id: ",", span: 2, label: "," }, { id: "space", span: 12, kind: "space" }, { id: ".", span: 2, label: "." }, { id: "enter", span: 4, label: "ENTER", kind: "go" }],
];
const IDS = new Set(ROWS.flat().filter((k) => !k.spacer).map((k) => k.id));

const idOf = (e: KeyboardEvent) =>
  e.key === " " ? "space" : e.key === "Backspace" ? "back" : e.key === "Enter" ? "enter"
  : e.key === "Shift" ? "shift" : e.key.length === 1 ? e.key.toLowerCase() : "";

export default function Keyboard({ open, shift, onKey }: { open: boolean; shift: boolean; onKey: (k: string) => void }) {
  const [down, setDown] = useState<Set<string>>(new Set());
  // Keep a key visibly pressed for at least 110ms, even when the click is faster than a frame.
  const t0 = useRef(new Map<string, number>());
  const press = (id: string) => { t0.current.set(id, performance.now()); mark(id, true); };
  const release = (id: string) => {
    const wait = Math.max(0, 110 - (performance.now() - (t0.current.get(id) ?? 0)));
    setTimeout(() => mark(id, false), wait);
  };
  const mark = (id: string, on: boolean) =>
    setDown((p) => {
      if (p.has(id) === on) return p;
      const n = new Set(p);
      if (on) n.add(id); else n.delete(id);
      return n;
    });

  // Real keystrokes press the matching on-screen key too.
  useEffect(() => {
    if (!open) return;
    const dn = (e: KeyboardEvent) => { const id = idOf(e); if (IDS.has(id) && !e.repeat) { press(id); sfx.key(id); } };
    const up = (e: KeyboardEvent) => { const id = idOf(e); if (IDS.has(id)) release(id); };
    const clear = () => setDown(new Set());
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    return () => { window.removeEventListener("keydown", dn); window.removeEventListener("keyup", up); window.removeEventListener("blur", clear); };
  }, [open]);

  return (
    <div className="kb" role="group" aria-label="Keyboard">
      {ROWS.map((row, ri) => (
        <div className="krow" key={ri}>
          {row.map((k) => k.spacer ? <span key={k.id} style={{ gridColumn: `span ${k.span}` }} /> : (
            <button key={k.id} type="button" tabIndex={-1} aria-label={k.label || "space"}
              className={`kc ${k.kind ?? ""} ${down.has(k.id) ? "down" : ""} ${k.id === "shift" && shift ? "lit" : ""}`}
              style={{ gridColumn: `span ${k.span}` }}
              onPointerDown={(e) => { e.preventDefault(); press(k.id); sfx.key(k.id); onKey(k.id); }}
              onPointerUp={() => release(k.id)} onPointerLeave={() => release(k.id)} onPointerCancel={() => release(k.id)}>
              {k.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
