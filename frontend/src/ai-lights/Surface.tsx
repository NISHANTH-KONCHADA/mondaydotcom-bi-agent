import React from 'react';

export function Surface({ dark = false }: { dark?: boolean }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 'inherit',
        background: dark
          ? 'radial-gradient(circle at 50% 0%, #262626 0%, #171717 100%)'
          : 'radial-gradient(circle at 50% 0%, #ffffff 0%, #fafafa 100%)',
        border: dark ? '1px solid #333333' : '1px solid #e5e5e5',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}
