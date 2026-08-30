import React from "react";
import type { Layer } from "./use-ai-lights";

export function RimGlow({ layers }: { layers: Layer[] }) {
  return (
    <>
      {layers.map((l, i) =>
        [0, 1].map((side) => (
          <span
            key={`${i}-${side}`}
            aria-hidden="true"
            className="ai-lights-layer"
            style={{
              position: 'absolute',
              inset: `${-l.pad}px`,
              maskImage: `url(${l.mask})`,
              WebkitMaskImage: `url(${l.mask})`,
              maskSize: '100% 100%',
              WebkitMaskSize: '100% 100%',
              transform: side ? "scaleX(-1)" : undefined,
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />
        )),
      )}
    </>
  );
}
