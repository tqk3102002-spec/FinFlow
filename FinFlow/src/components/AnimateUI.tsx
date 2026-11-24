import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, X, type LucideIcon } from 'lucide-react';
import type { ToastItem } from '../types/finance';

export interface GlidingTabItem {
  id: string;
  label: string;
  icon?: LucideIcon;
}

export const GlidingTabs = React.memo(function GlidingTabs({
  items,
  value,
  onChange,
  variant = 'segmented',
  className = '',
}: {
  items: GlidingTabItem[];
  value: string;
  onChange: (id: string) => void;
  variant?: 'segmented' | 'auth' | 'subtab' | 'tempo';
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [pill, setPill] = useState({ left: 0, width: 0, ready: false });

  const measure = useCallback(() => {
    const activeEl = itemRefs.current[value];
    if (!activeEl) return;
    setPill((prev) => ({
      left: activeEl.offsetLeft,
      width: activeEl.offsetWidth,
      ready: prev.width > 0,
    }));
  }, [value]);

  useLayoutEffect(() => {
    measure();
    const raf = requestAnimationFrame(() => {
      const activeEl = itemRefs.current[value];
      if (!activeEl) return;
      setPill({ left: activeEl.offsetLeft, width: activeEl.offsetWidth, ready: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [measure, items, value]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => measure());
      ro.observe(el);
    }
    return () => {
      window.removeEventListener('resize', onResize);
      if (ro) ro.disconnect();
    };
  }, [measure]);

  const stylesByVariant = {
    segmented: {
      wrapper:
        'relative inline-flex items-center p-1 rounded-lg bg-[#EFEDE7] dark:bg-[#1C2430] border border-[#E4E2DB] dark:border-[#262F3D]',
      pill: 'top-1 bottom-1 rounded-md bg-white dark:bg-[#151B23] border border-[#E4E2DB]/80 dark:border-[#2F3A4C]',
      btn: 'relative z-10 px-2.5 py-1 rounded-md text-xs font-medium transition-colors duration-150 whitespace-nowrap shrink-0',
      activeText: 'text-[#141413] dark:text-[#ECEBE6] font-semibold',
      idleText: 'text-[#63625C] dark:text-[#8E98A8] hover:text-[#141413] dark:hover:text-[#ECEBE6]',
    },
    auth: {
      wrapper:
        'relative grid grid-cols-2 p-1 rounded-lg bg-[#EFEDE7] dark:bg-[#1C2430] border border-[#E4E2DB] dark:border-[#262F3D]',
      pill: 'top-1 bottom-1 rounded-md bg-white dark:bg-[#151B23] border border-[#E4E2DB]/80 dark:border-[#2F3A4C]',
      btn: 'relative z-10 py-2 rounded-md text-xs font-semibold transition-colors duration-150 text-center whitespace-nowrap',
      activeText: 'text-[#141413] dark:text-[#ECEBE6]',
      idleText: 'text-[#63625C] dark:text-[#8E98A8] hover:text-[#141413] dark:hover:text-[#ECEBE6]',
    },
    subtab: {
      wrapper:
        'relative inline-flex items-center p-1 rounded-lg bg-white dark:bg-[#151B23] border border-[#E4E2DB] dark:border-[#262F3D] overflow-x-auto max-w-full',
      pill: 'top-1 bottom-1 rounded-md bg-[#0E5A4F] dark:bg-[#38B29A]',
      btn: 'relative z-10 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors duration-150 whitespace-nowrap shrink-0',
      activeText: 'text-white dark:text-[#0D1117]',
      idleText: 'text-[#63625C] dark:text-[#8E98A8] hover:text-[#141413] dark:hover:text-[#ECEBE6]',
    },
    tempo: {
      wrapper:
        'relative inline-flex items-center p-1 rounded-lg bg-[#EFEDE7] dark:bg-[#1C2430] border border-[#E4E2DB] dark:border-[#262F3D] overflow-x-auto max-w-full',
      pill: 'top-1 bottom-1 rounded-md bg-[#0E5A4F] dark:bg-[#38B29A]',
      btn: 'relative z-10 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors duration-150 whitespace-nowrap shrink-0 font-num',
      activeText: 'text-white dark:text-[#0D1117]',
      idleText: 'text-[#63625C] dark:text-[#8E98A8] hover:text-[#141413] dark:hover:text-[#ECEBE6]',
    },
  };

  const st = stylesByVariant[variant];

  return (
    <div ref={containerRef} role="tablist" className={`${st.wrapper} ${className}`}>
      {pill.width > 0 && (
        <span
          aria-hidden="true"
          data-ready={pill.ready ? 'true' : 'false'}
          className={`aui-indicator-pill ${st.pill}`}
          style={{
            width: `${pill.width}px`,
            transform: `translateX(${pill.left}px)`,
          }}
        />
      )}
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            ref={(node) => {
              itemRefs.current[item.id] = node;
            }}
            onClick={() => onChange(item.id)}
            className={`${st.btn} ${active ? st.activeText : st.idleText} inline-flex items-center justify-center gap-1.5`}
          >
            {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
});

export function AnimatedModal({
  open,
  onClose,
  maxWidthClass = 'max-w-md',
  tempo = 1,
  reducedMotion = false,
  children,
}: {
  open: boolean;
  onClose?: () => void;
  maxWidthClass?: string;
  tempo?: number;
  reducedMotion?: boolean;
  children: React.ReactNode;
}) {
  const [rendered, setRendered] = useState(open);
  const [phase, setPhase] = useState<'open' | 'exiting' | 'closed'>(open ? 'open' : 'closed');
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      setRendered(true);
      setPhase('open');
      return;
    }
    if (!rendered) return;
    setPhase('exiting');
    const dismissMs = reducedMotion ? 120 : Math.round(190 * tempo);
    const timer = setTimeout(() => {
      setRendered(false);
      setPhase('closed');
    }, dismissMs);
    return () => clearTimeout(timer);
  }, [open, rendered, tempo, reducedMotion]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.inert = phase === 'exiting';
  }, [phase, rendered]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!rendered) return null;

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-hidden={phase === 'exiting' ? 'true' : undefined}
      data-state={phase === 'exiting' ? 'exiting' : 'open'}
      onClick={(e) => {
        if (e.target === e.currentTarget && phase !== 'exiting' && onClose) onClose();
      }}
      className="aui-modal-backdrop fixed inset-0 z-50 bg-[#141413]/45 dark:bg-black/70 backdrop-blur-[2px] flex items-center justify-center p-4"
    >
      <div
        data-state={phase === 'exiting' ? 'exiting' : 'open'}
        className={`aui-modal-panel bg-white dark:bg-[#151B23] rounded-xl border border-[#E4E2DB] dark:border-[#262F3D] w-full ${maxWidthClass} shadow-xl overflow-hidden max-h-[92vh] flex flex-col`}
      >
        {children}
      </div>
    </div>
  );
}

export function StatusButton({
  status = 'idle',
  states,
  className = '',
  disabled = false,
  type = 'button',
  onClick,
  title,
}: {
  status?: 'idle' | 'loading' | 'done';
  states: Record<string, React.ReactNode>;
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onClick?: () => void;
  title?: string;
}) {
  const entries = Object.entries(states);
  return (
    <button
      type={type}
      title={title}
      disabled={disabled || status === 'loading'}
      onClick={onClick}
      className={`aui-btn aui-status-grid ${className}`}
    >
      {entries.map(([key, content]) => (
        <span
          key={key}
          data-active={status === key ? 'true' : 'false'}
          aria-hidden={status !== key}
          className="aui-status-slot"
        >
          {content}
        </span>
      ))}
    </button>
  );
}

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (!toasts || toasts.length === 0) return null;
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-20 lg:bottom-5 right-4 z-50 flex flex-col items-end gap-2 pointer-events-none max-w-[calc(100vw-2rem)]"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          data-state={t.exiting ? 'exiting' : 'open'}
          className={`aui-toast-item pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 rounded-lg shadow-lg border text-xs font-medium max-w-sm ${
            t.type === 'error'
              ? 'bg-[#FFF1F3] dark:bg-[#2A141A] border-[#F6C4CE] dark:border-[#6B2135] text-[#9F1239] dark:text-[#FDA4AF]'
              : t.type === 'warning'
              ? 'bg-[#FFFBEB] dark:bg-[#261E0F] border-[#F2D59B] dark:border-[#6B4E16] text-[#92400E] dark:text-[#FCD34D]'
              : 'bg-[#141413] dark:bg-[#1C2430] border-[#2A2A27] dark:border-[#2F3A4C] text-[#F6F5F1] dark:text-[#ECEBE6]'
          }`}
        >
          {t.type === 'error' || t.type === 'warning' ? (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#38B29A]" />
          )}
          <span className="leading-snug">{t.message}</span>
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            className="ml-1 opacity-60 hover:opacity-100 transition-opacity shrink-0"
            aria-label="Đóng thông báo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
