import { getCurrentEffect } from "./effect";

export type ReactivityEvent = {
  kind: "track" | "trigger";
  targetId: number;
  targetLabel: string;
  key: string;
  componentId: number;
  componentName: string;
  time: number;
};

export type ReactivityListener = (event: ReactivityEvent) => void;

const listeners = new Set<ReactivityListener>();
const targetIds = new WeakMap<object, number>();
const refLabels = new WeakMap<object, string>();
let nextTargetId = 1;

function getTargetId(target: object): number {
  const existing = targetIds.get(target);
  if (existing) return existing;
  const id = nextTargetId++;
  targetIds.set(target, id);
  return id;
}

function emit(kind: ReactivityEvent["kind"], target: object, key: string) {
  if (listeners.size === 0) return;
  const effect = getCurrentEffect();
  const meta = (effect as any)?.meta as
    | { type?: string; componentId?: number; componentName?: string }
    | undefined;
  if (!meta || meta.type !== "render" || meta.componentId === undefined) return;

  const targetId = getTargetId(target);
  const targetLabel = refLabels.get(target) || `ref#${targetId}`;
  const componentName =
    meta.componentName && String(meta.componentName).trim().length > 0
      ? meta.componentName
      : "App";

  const event: ReactivityEvent = {
    kind,
    targetId,
    targetLabel,
    key,
    componentId: meta.componentId,
    componentName,
    time: Date.now(),
  };

  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // ignore listener errors
    }
  }
}

export function subscribeReactivity(listener: ReactivityListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setRefLabel(target: object, label: string) {
  if (!label) return;
  refLabels.set(target, label);
}

export function getRefLabel(target: object): string | undefined {
  return refLabels.get(target);
}

export function trackRef(target: object, key = "value") {
  emit("track", target, String(key));
}

export function triggerRef(target: object, key = "value") {
  emit("trigger", target, String(key));
}
