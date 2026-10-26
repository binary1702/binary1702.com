"use client";

import { useMemo, useState } from "react";
import GenerativeCanvas from "@/components/lab/GenerativeCanvas";
import { LorenzSystem, CanopySystem, ReactionSystem, type GenerativeSystem } from "@/lib/generative";
import s from "./lab.module.css";

/* ------------------------------------------------------------------
   /lab/generative — presentation layer.
   Three systems, one canvas, a minimal instrument panel. Nothing here
   is commercial on purpose: the lab exists to choose a visual system
   before it meets the homepage.
   ------------------------------------------------------------------ */

const KEYS = ["chaos", "canopy", "emergence"] as const;
type Key = (typeof KEYS)[number];

export default function GenerativeLab() {
  const [key, setKey] = useState<Key>("chaos");
  const [paused, setPaused] = useState(false);

  // one instance per system, created lazily and kept so switching back resumes where it left off
  const systems = useMemo<Record<Key, GenerativeSystem>>(
    () => ({ chaos: new LorenzSystem(), canopy: new CanopySystem(), emergence: new ReactionSystem() }),
    [],
  );
  const system = systems[key];
  const idx = KEYS.indexOf(key) + 1;

  return (
    <div className={s.lab}>
      <div className={s.canvas}>
        <GenerativeCanvas system={system} paused={paused} />
      </div>

      <div className={s.brand}>
        <b>Binary</b> 1702 <span>Lab</span>
      </div>
      <div className={s.index} aria-hidden="true">
        {String(idx).padStart(2, "0")} / {String(KEYS.length).padStart(2, "0")}
      </div>

      <div className={s.panel}>
        <div>
          <h1 className={s.title}>{system.title}</h1>
          <p className={s.algo}>{system.algorithm}</p>
          <p className={s.desc}>{system.description}</p>
        </div>

        <div className={s.controls}>
          <div className={s.tabs} role="tablist" aria-label="Experiments">
            {KEYS.map((k, i) => (
              <button
                key={k}
                role="tab"
                aria-selected={key === k}
                className={s.tab}
                onClick={() => setKey(k)}
              >
                <i>{String(i + 1).padStart(2, "0")}</i>
                {systems[k].title}
              </button>
            ))}
          </div>
          <button type="button" className={s.pause} onClick={() => setPaused((p) => !p)} aria-pressed={paused}>
            {paused ? "Resume" : "Pause"}
          </button>
        </div>
      </div>
    </div>
  );
}
