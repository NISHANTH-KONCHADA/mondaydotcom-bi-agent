import React from 'react';

export function FrostedWord({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-block',
        verticalAlign: 'middle',
      }}
    >
      {/* Background radial glow */}
      <span
        aria-hidden="true"
        style={{
          pointerEvents: 'none',
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 0,
          width: '260px',
          height: '80px',
          background: 'radial-gradient(ellipse 100% 100% at 50% 50%, rgba(249, 115, 22, 0.15) 0%, transparent 70%)',
          filter: 'blur(20px)',
        }}
      />

      {/* Main glass wrapper container */}
      <span
        style={{
          position: 'relative',
          display: 'inline-block',
          transform: 'translateX(-1px) translateY(-1px) rotate(-0.5deg)',
          zIndex: 1,
        }}
      >
        {/* Soft shadow twin (blurred background text) */}
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            color: 'var(--text-primary)',
            opacity: 0.14,
            filter: 'blur(8px)',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          {children}
        </span>

        {/* Deep chromatic twin: refraction plane */}
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            color: 'var(--text-primary)',
            opacity: 0.16,
            transform: 'translate(-1.5px, 2.5px)',
            filter: 'blur(4px)',
            maskImage: 'linear-gradient(186deg, transparent 20%, black 100%)',
            WebkitMaskImage: 'linear-gradient(186deg, transparent 20%, black 100%)',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          {children}
        </span>

        {/* Sharp top layer */}
        <span
          style={{
            position: 'relative',
            zIndex: 2,
            display: 'inline-block',
            maskImage: 'linear-gradient(186deg, black 0%, black 50%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(186deg, black 0%, black 50%, transparent 100%)',
          }}
        >
          {children}
        </span>

        {/* Blurred bottom layer */}
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 2,
            filter: 'blur(1.8px)',
            maskImage: 'linear-gradient(186deg, transparent 0%, black 60%, black 100%)',
            WebkitMaskImage: 'linear-gradient(186deg, transparent 0%, black 60%, black 100%)',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          {children}
        </span>

        {/* Near chromatic twin */}
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            color: 'var(--text-primary)',
            opacity: 0.25,
            transform: 'translate(1.5px, 1.5px)',
            filter: 'blur(3px)',
            maskImage: 'linear-gradient(186deg, transparent 30%, black 100%)',
            WebkitMaskImage: 'linear-gradient(186deg, transparent 30%, black 100%)',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          {children}
        </span>

        {/* Specular top sheen */}
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            color: 'rgba(255, 255, 255, 0.95)',
            opacity: 0.7,
            maskImage: 'linear-gradient(180deg, black 0%, transparent 35%)',
            WebkitMaskImage: 'linear-gradient(180deg, black 0%, transparent 35%)',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          {children}
        </span>

        {/* Rounded glass-chip overlay border & shadow */}
        <span
          aria-hidden="true"
          style={{
            pointerEvents: 'none',
            position: 'absolute',
            inset: '-4px -10px',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.12) 38%, rgba(255,255,255,0.06) 62%, rgba(255,255,255,0.2) 100%)',
            border: '1px solid rgba(0,0,0,0.08)',
            borderTopColor: 'rgba(255,255,255,0.85)',
            borderRadius: '10px',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -1px 1px rgba(0,0,0,0.05), inset 0 0 0 2px rgba(255,255,255,0.15), 0 2px 6px rgba(0,0,0,0.06)',
            zIndex: 3,
          }}
        />

        {/* Top highlight gradient */}
        <span
          aria-hidden="true"
          style={{
            pointerEvents: 'none',
            position: 'absolute',
            inset: '-4px -10px',
            borderRadius: '10px',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.7), transparent 15%)',
            mixBlendMode: 'overlay',
            zIndex: 4,
          }}
        />
      </span>
    </span>
  );
}
