import React, { useEffect, useRef } from 'react';
import { FrostedWord } from './FrostedWord';
import { FlyingCursors, type CursorDef } from './engine';

const DEFAULT_CURSORS: CursorDef[] = [
  { name: 'Deals', color: '#F97316' },
  { name: 'Orders', color: '#3B82F6' },
  { name: 'Finance', color: '#10B981' },
];

export function FrostedLogo({
  text = 'Skylark BI',
  onClick,
}: {
  text?: string;
  onClick?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<FlyingCursors | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const engine = new FlyingCursors(containerRef.current, DEFAULT_CURSORS);
    engine.start();
    engineRef.current = engine;

    return () => {
      engine.destroy();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      onClick={onClick}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '6px 14px',
        minHeight: '44px',
        cursor: 'pointer',
        overflow: 'visible',
        userSelect: 'none',
      }}
      title="Skylark BI — Click to return home"
    >
      <FrostedWord>
        <span
          style={{
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '19px',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            color: 'var(--text-primary)',
            padding: '2px 4px',
            whiteSpace: 'nowrap',
            display: 'inline-block',
          }}
        >
          {text}
        </span>
      </FrostedWord>
    </div>
  );
}
