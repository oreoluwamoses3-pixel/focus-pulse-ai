import { useEffect, useRef, useState } from 'react';
import { Info, X, RotateCcw } from 'lucide-react';
import { reset } from '@/lib/repo';

export function DemoBadge({ visible }: { visible: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!visible) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full border border-warning-500/40 bg-warning-500/10 px-2.5 py-1 text-xs font-semibold text-warning-400 transition-colors hover:bg-warning-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-warning-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-expanded={open}
        aria-label="Demo mode — sample data info"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-warning-400 animate-pulse" />
        Demo Mode · Sample data
        <Info size={12} className="opacity-70" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-border bg-surface-2 p-4 shadow-2xl shadow-black/40 animate-slide-up" role="dialog" aria-label="Demo mode info">
          <div className="flex items-start justify-between">
            <h3 className="text-sm font-semibold text-foreground">Demo Mode</h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 rounded"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            You're exploring FocusPulse AI with sample goals and tasks. Your progress is saved locally in this browser. Reset to clear all data and start fresh.
          </p>
          <button
            type="button"
            onClick={() => {
              reset();
              setOpen(false);
            }}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-warning-500/15 px-3 py-2 text-xs font-semibold text-warning-400 transition-colors hover:bg-warning-500/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-warning-400"
          >
            <RotateCcw size={14} />
            Reset to sample data
          </button>
        </div>
      )}
    </div>
  );
}
