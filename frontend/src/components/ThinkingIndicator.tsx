import React, { useEffect, useRef, useState } from 'react';

const THINKING_STATES = [
  "Querying Monday.com GraphQL API v2...",
  "Loading 346 Deals and 176 Work Orders...",
  "Running cross-board reconciliation...",
  "Evaluating data coverage and anomalies...",
  "Synthesizing founder-level response...",
];

export function ThinkingIndicator() {
  const [index, setIndex] = useState(0);
  const [animClass, setAnimClass] = useState<'' | 'is-exit' | 'is-enter-start'>('');
  const timeoutRef = useRef<number[]>([]);

  const longestState = THINKING_STATES.reduce(
    (a, b) => (a.length > b.length ? a : b),
    THINKING_STATES[0]
  );

  const clearTimers = () => {
    timeoutRef.current.forEach(t => window.clearTimeout(t));
    timeoutRef.current = [];
  };

  useEffect(() => {
    const hold = 2200;
    const swap = 180;
    const gap = 50;

    const interval = window.setInterval(() => {
      // Step 1: trigger exit
      setAnimClass('is-exit');

      const t1 = window.setTimeout(() => {
        // Step 2: swap state and set enter-start without transition
        setIndex((prev) => (prev + 1) % THINKING_STATES.length);
        setAnimClass('is-enter-start');

        const t2 = window.setTimeout(() => {
          // Step 3: release to normal position with smooth enter transition
          setAnimClass('');
        }, gap);
        timeoutRef.current.push(t2);
      }, swap);
      timeoutRef.current.push(t1);
    }, hold + swap + gap);

    return () => {
      window.clearInterval(interval);
      clearTimers();
    };
  }, []);

  const currentState = THINKING_STATES[index];

  return (
    <span className="t-think" role="status" aria-live="polite">
      <span className="t-think-sizer" aria-hidden="true">
        {longestState}
      </span>
      <span
        className={`t-think-text ${animClass}`}
        data-text={currentState}
      >
        {currentState}
      </span>
    </span>
  );
}
