import type { ReactNode } from 'react';
import { create } from 'zustand';
import type { Intent } from '../../design/variants';

export type ToastIntent = Intent;

export interface Toast {
  readonly id: string;
  readonly title: string;
  readonly description?: ReactNode;
  readonly intent?: ToastIntent;
  readonly duration?: number;
}

interface ToastState {
  readonly toasts: ReadonlyArray<Toast>;
  push: (toast: Omit<Toast, 'id'>) => string;
  dismiss: (id: string) => void;
}

let counter = 0;
const nextId = (): string => {
  counter += 1;
  return `toast-${counter}`;
};

/**
 * Toast store — a tiny Zustand store backing Nova's notification surface. Kept
 * deliberately minimal: push/dismiss only. Auto-dismiss timers live in the
 * viewport component so they respect tab visibility.
 */
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = nextId();
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Imperative API for non-component callers (e.g. event handlers). */
export const toast = {
  show: (t: Omit<Toast, 'id'>): string => useToastStore.getState().push(t),
  success: (title: string, description?: ReactNode): string =>
    useToastStore.getState().push({ title, description, intent: 'success' }),
  error: (title: string, description?: ReactNode): string =>
    useToastStore.getState().push({ title, description, intent: 'danger' }),
  info: (title: string, description?: ReactNode): string =>
    useToastStore.getState().push({ title, description, intent: 'info' }),
  dismiss: (id: string): void => useToastStore.getState().dismiss(id),
};
