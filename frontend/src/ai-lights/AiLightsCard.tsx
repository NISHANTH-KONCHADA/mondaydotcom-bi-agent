import React, { useCallback, useEffect, useRef, useState } from "react";
import { DARK_KEYS, VARIANTS, radiusFor, useVariantSizes } from "./variants";
import { RimGlow } from "./RimGlow";
import { Surface } from "./Surface";
import { useAiPulse, useRimMask } from "./use-ai-lights";

const PULSE_MS = 1600;
const FADE_OUT_MS = 160;
const MORPH_MS = 380;
const HANDOVER_AT = PULSE_MS + 120;
const SETTLED_MS = 260;
const GAP_MS =
  HANDOVER_AT - PULSE_MS + FADE_OUT_MS + MORPH_MS + 80 + SETTLED_MS;

export function AiLightsCard({ onClick }: { onClick?: () => void }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const { sizes, probe } = useVariantSizes();

  const [slot, setSlot] = useState(0);
  const slotRef = useRef(0);
  const [showing, setShowing] = useState(true);
  const [morphing, setMorphing] = useState(false);
  const [gen, setGen] = useState(0);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
  };
  const after = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const variant = VARIANTS[slot];
  const size = sizes?.[slot];
  const radius = size ? radiusFor(variant, size.h + 2) : 16;
  const layers = useRimMask(bodyRef, 90, undefined, radius);

  useAiPulse({
    pulseMs: PULSE_MS,
    gapMs: GAP_MS,
    onPulse: useCallback(() => {
      clearTimers();
      after(HANDOVER_AT, () => {
        setShowing(false);
        after(FADE_OUT_MS, () => {
          bodyRef.current?.removeAttribute("data-playing");
          setMorphing(true);
          slotRef.current = (slotRef.current + 1) % VARIANTS.length;
          setSlot(slotRef.current);
          after(MORPH_MS, () => {
            setMorphing(false);
            setGen((g) => g + 1);
            setShowing(true);
          });
        });
      });
    }, []),
    ref: bodyRef,
    paletteRef: cardRef,
  });

  useEffect(() => clearTimers, []);

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        userSelect: 'none',
      }}
      title="Skylark BI — Click to reset / Return to home"
    >
      {probe}

      <div
        ref={bodyRef}
        data-morphing={morphing ? "true" : undefined}
        className="ai-lights-body"
        style={
          {
            position: 'relative',
            width: size ? `${size.w + 2}px` : undefined,
            height: size ? `${size.h + 2}px` : undefined,
            borderRadius: `${radius}px`,
            padding: '1px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 6px 16px rgba(0,0,0,0.06)',
            transition: `width ${MORPH_MS}ms cubic-bezier(0.22, 1, 0.36, 1), height ${MORPH_MS}ms cubic-bezier(0.22, 1, 0.36, 1), border-radius ${MORPH_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
          } as React.CSSProperties
        }
      >
        <RimGlow layers={layers} />

        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            borderRadius: `calc(${radius}px - 1px)`,
            backgroundColor: DARK_KEYS.has(variant.key) ? "#171717" : "var(--card-bg, #ffffff)",
            transition: `background-color ${MORPH_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
            zIndex: 2,
          }}
        >
          <Surface dark={DARK_KEYS.has(variant.key)} />

          <div
            key={gen}
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              padding: variant.pad,
              opacity: showing ? 1 : 0,
              contentVisibility: morphing ? "hidden" : undefined,
              transition: `opacity ${FADE_OUT_MS}ms ease`,
              zIndex: 3,
            }}
          >
            <variant.Content />
          </div>
        </div>
      </div>
    </div>
  );
}
