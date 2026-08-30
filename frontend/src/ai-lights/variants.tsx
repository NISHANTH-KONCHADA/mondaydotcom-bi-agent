import React, { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "./use-ai-lights";

const STAGGER_MS = 20;
const CHAR_MS = 300;

export function RisingText({
  text,
  className = "",
  delay = 0,
  style,
}: {
  text: string;
  className?: string;
  delay?: number;
  style?: React.CSSProperties;
}) {
  const { reduced } = useReducedMotion();
  return (
    <span
      className={`ai-rising-text ${className}`}
      style={{ display: 'block', whiteSpace: 'nowrap', lineHeight: 1, ...style }}
    >

      {Array.from(text).map((ch, i) => (
        <span
          key={i}
          className={reduced ? "ai-char-fade" : "ai-char-rise"}
          style={
            {
              display: 'inline-block',
              verticalAlign: 'middle',
              animationDuration: `${CHAR_MS}ms`,
              animationDelay: reduced ? `${delay}ms` : `${delay + i * STAGGER_MS}ms`,
              width: ch === " " ? "0.28em" : undefined,
            } as React.CSSProperties
          }
        >
          {ch === " " ? "\u00A0" : ch}
        </span>
      ))}
    </span>
  );
}

export interface Variant {
  key: string;
  radius: number | "pill";
  pad: string;
  Content: () => React.ReactElement;
}

function Trail({
  children,
  delay = 140,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <span
      className="ai-char-fade"
      style={{
        flexShrink: 0,
        fontSize: '13px',
        lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
        color: 'var(--text-secondary, #737373)',
        animationDelay: `${delay}ms`,
      }}
    >
      {children}
    </span>
  );
}

function Row({
  children,
  trail,
}: {
  children: React.ReactNode;
  trail?: React.ReactNode;
}) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ minWidth: 0, flex: 1 }}>{children}</span>
      {trail}
    </span>
  );
}

function Step({
  label,
  state,
  delay,
}: {
  label: string;
  state: "done" | "live" | "next";
  delay: number;
}) {
  return (
    <span style={{ display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
      <span
        className="ai-char-fade"
        style={{
          position: 'relative',
          display: 'grid',
          width: '14px',
          height: '14px',
          flexShrink: 0,
          placeItems: 'center',
          animationDelay: `${delay}ms`,
        }}
      >
        <span
          style={{
            width: '12px',
            height: '12px',
            borderRadius: '4px',
            background:
              state === 'done'
                ? 'var(--text-secondary, #737373)'
                : state === 'live'
                ? 'var(--text-primary, #171717)'
                : '#f4f4f5',
            border: state === 'next' ? '1px solid #e5e5e5' : 'none',
          }}
        />
        {state === 'live' && (
          <span
            className="ai-ring-pulse"
            style={{
              position: 'absolute',
              inset: '-3px',
              borderRadius: '6px',
              border: '1px solid var(--text-primary, #171717)',
            }}
          />
        )}
      </span>
      <span
        className="ai-char-fade"
        style={{
          fontSize: '13px',
          lineHeight: 1,
          animationDelay: `${delay + 60}ms`,
          color: state === 'next' ? 'var(--text-muted, #a3a3a3)' : 'var(--text-primary, #171717)',
          fontWeight: 500,
        }}
      >
        {label}
      </span>
    </span>
  );
}

function BlockContent() {
  const steps: { label: string; state: "done" | "live" | "next" }[] = [
    { label: "Fetch", state: "done" },
    { label: "Analyze", state: "live" },
    { label: "Report", state: "next" },
  ];
  return (
    <span style={{ display: 'block', width: '250px' }}>
      <span style={{ position: 'relative', display: 'flex', alignItems: 'flex-start' }}>
        <span
          className="ai-char-fade"
          style={{
            position: 'absolute',
            top: '7px',
            left: '16.66%',
            right: '16.66%',
            height: '1px',
            background: '#e5e5e5',
            animationDelay: '60ms',
          }}
        />
        {steps.map((st, i) => (
          <Step key={st.label} {...st} delay={100 + i * 70} />
        ))}
      </span>
    </span>
  );
}

function ProgressContent() {
  return (
    <span style={{ display: 'block', width: '230px' }}>
      <Row
        trail={
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Trail delay={120}>84%</Trail>
            <svg
              viewBox="0 0 16 16"
              style={{ width: '14px', height: '14px', flexShrink: 0 }}
              aria-hidden="true"
            >
              <circle cx="8" cy="8" r="6" fill="none" stroke="#e5e5e5" strokeWidth="2" />
              <path
                d="M8 2A6 6 0 0 1 14 8"
                className="ai-spinner"
                fill="none"
                stroke="var(--accent, #F97316)"
                strokeWidth="2"
                strokeLinecap="round"
                style={{ transformOrigin: '8px 8px' }}
              />
            </svg>
          </span>
        }
      >
        <RisingText
          text="Syncing Boards"
          style={{ fontSize: '15px', color: 'var(--text-primary, #171717)', fontWeight: 600 }}
        />
      </Row>
    </span>
  );
}

function TerminalContent() {
  return (
    <span style={{ display: 'block', width: '220px', fontFamily: 'ui-monospace, monospace' }}>
      <span style={{ display: 'block', fontSize: '13px', lineHeight: 1.4, color: '#a3a3a3' }}>
        <span style={{ color: '#F97316' }}>$</span> monday.query
      </span>
      <RisingText
        text="346 deals loaded"
        style={{ display: 'block', fontSize: '13px', lineHeight: 1.4, color: '#f5f5f5', marginTop: '4px' }}
        delay={60}
      />
    </span>
  );
}

function WandContent() {
  return (
    <span style={{ display: 'block', width: '260px' }}>
      <Row
        trail={
          <span
            style={{
              display: 'grid',
              width: '28px',
              height: '28px',
              flexShrink: 0,
              placeItems: 'center',
              borderRadius: '8px',
              background: 'var(--accent, #F97316)',
              color: '#ffffff',
            }}
          >
            <svg
              viewBox="0 0 12 12"
              style={{ width: '12px', height: '12px', fill: 'none', stroke: '#ffffff' }}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 9.5V2.5M6 2.5 3 5.5M6 2.5 9 5.5" />
            </svg>
          </span>
        }
      >
        <RisingText
          text="Skylark Intelligence"
          style={{ fontSize: '15px', color: 'var(--text-primary, #171717)', fontWeight: 600 }}
        />
      </Row>
    </span>
  );
}

export const VARIANTS: Variant[] = [
  { key: "wand", radius: 18, pad: "10px 14px", Content: WandContent },
  { key: "progress", radius: 15, pad: "12px 18px", Content: ProgressContent },
  { key: "block", radius: 16, pad: "14px 18px", Content: BlockContent },
  { key: "terminal", radius: 16, pad: "12px 18px", Content: TerminalContent },
];

export const DARK_KEYS = new Set(["terminal"]);

export function radiusFor(v: Variant, height: number): number {
  return v.radius === "pill" ? height / 2 : v.radius;
}

export function useVariantSizes(): {
  sizes: { w: number; h: number }[] | null;
  probe: React.ReactElement;
} {
  const ref = useRef<HTMLDivElement>(null);
  const [sizes, setSizes] = useState<{ w: number; h: number }[] | null>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const measure = () => {
      const boxes = Array.from(
        host.querySelectorAll<HTMLElement>("[data-probe]"),
      ).map((el) => {
        const r = el.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height) };
      });
      if (boxes.length === VARIANTS.length && boxes.every((b) => b.w && b.h)) {
        setSizes(boxes);
      }
    };
    measure();
    document.fonts?.ready.then(measure).catch(() => {});
  }, []);

  const probe = (
    <div
      ref={ref}
      aria-hidden="true"
      style={{
        pointerEvents: 'none',
        visibility: 'hidden',
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: -10,
      }}
    >
      {VARIANTS.map((v) => (
        <div key={v.key} data-probe style={{ display: 'inline-block', padding: v.pad }}>
          <v.Content />
        </div>
      ))}
    </div>
  );

  return { sizes, probe };
}
