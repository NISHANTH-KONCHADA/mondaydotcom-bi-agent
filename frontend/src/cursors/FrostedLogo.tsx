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
  className = '',
}: {
  text?: string;
  onClick?: () => void;
  className?: string;
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
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '8px 18px',
        minHeight: '48px',
        cursor: 'pointer',
        overflow: 'visible',
      }}
      title="Skylark BI — Click to return home"
    >
      <FrostedWord>
        <span
          style={{
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '20px',
            fontWeight: 800,
            letterSpacing: '-0.035em',
            color: 'var(--text-primary)',
            padding: '2px 4px',
            whiteSpace: 'nowrap',
          }}
        >
          {text}
        </span>
      </FrostedWord>
    </div>
  );
}
