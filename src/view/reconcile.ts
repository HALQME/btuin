import { isBlock, type ViewElement } from "./types/elements";

function identityKey(element: ViewElement): string | undefined {
  return element.key ?? element.identifier;
}

function styleValueEquals(key: string, a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (key === "outline") {
    if (!a || !b) return false;
    if (typeof a !== "object" || typeof b !== "object") return false;
    const ao = a as any;
    const bo = b as any;
    return ao.style === bo.style && ao.color === bo.color;
  }
  if (key === "padding" || key === "margin") {
    if (typeof a === "number" && typeof b === "number") return a === b;
    if (Array.isArray(a) && Array.isArray(b) && a.length === 4 && b.length === 4) {
      return a.every((v, i) => v === b[i]);
    }
    return false;
  }
  if (key === "gap") {
    if (!a || !b) return false;
    if (typeof a !== "object" || typeof b !== "object") return false;
    const ao = a as any;
    const bo = b as any;
    return ao.width === bo.width && ao.height === bo.height;
  }
  return false;
}

function syncStyle(
  target: NonNullable<ViewElement["style"]>,
  source: NonNullable<ViewElement["style"]>,
) {
  const keys = new Set<string>([...Object.keys(target), ...Object.keys(source)]);
  for (const key of keys) {
    const nextValue = (source as any)[key];
    if (nextValue === undefined) {
      if (Object.prototype.hasOwnProperty.call(target, key)) {
        delete (target as any)[key];
      }
      continue;
    }
    const prevValue = (target as any)[key];
    if (styleValueEquals(key, prevValue, nextValue)) continue;
    (target as any)[key] = nextValue;
  }
}

function canReuse(prev: ViewElement, next: ViewElement): boolean {
  if (prev.type !== next.type) return false;
  const prevKey = identityKey(prev);
  const nextKey = identityKey(next);
  if (nextKey) return prevKey === nextKey;
  // Unkeyed nodes: reuse by slot (type + position), which is safe enough for retained-mode
  // as long as parents reconcile by index when keys are absent.
  return true;
}

function reconcileChildren(prev: ViewElement, next: ViewElement): void {
  if (!isBlock(prev) || !isBlock(next)) return;

  const nextChildren = next.children;
  const prevChildren = prev.children;

  let anyNextKeyed = false;
  for (const c of nextChildren) {
    if (identityKey(c)) {
      anyNextKeyed = true;
      break;
    }
  }

  const updated: ViewElement[] = [];
  if (anyNextKeyed) {
    const prevByKey = new Map<string, ViewElement>();
    for (const child of prevChildren) {
      const k = identityKey(child);
      if (k) prevByKey.set(k, child);
    }
    for (const nextChild of nextChildren) {
      const k = identityKey(nextChild);
      const prevChild = k ? prevByKey.get(k) : undefined;
      updated.push(reconcileTree(prevChild, nextChild));
    }
  } else {
    for (let i = 0; i < nextChildren.length; i++) {
      const prevChild = prevChildren[i];
      updated.push(reconcileTree(prevChild, nextChildren[i]!));
    }
  }

  if (
    prevChildren.length === updated.length &&
    updated.every((child, i) => prevChildren[i] === child)
  ) {
    return;
  }

  prevChildren.splice(0, prevChildren.length, ...updated);
}

function syncIdentity(prev: ViewElement, next: ViewElement): void {
  const nextKey = identityKey(next);
  if (!nextKey) return;
  if (identityKey(prev) === nextKey) return;
  prev.setKey(nextKey);
}

function syncCommonProps(prev: ViewElement, next: ViewElement): void {
  // Key is used for layout addressing; keep it stable when explicitly provided.
  syncIdentity(prev, next);

  if (next.focusKey !== undefined && prev.focusKey !== next.focusKey) {
    prev.focus(next.focusKey);
  }

  syncStyle(prev.style, next.style);
}

function syncLeafProps(prev: ViewElement, next: ViewElement): void {
  if (prev.type === "text" && next.type === "text") {
    prev.content = next.content;
    return;
  }
  if (prev.type === "input" && next.type === "input") {
    prev.value = next.value;
  }
}

/**
 * Reconciles an immediate-mode `next` tree into a retained `prev` tree.
 *
 * This enables retained-mode behavior (stable object identities) without forcing
 * user code to cache ViewElement instances manually.
 *
 * - If `next` nodes have stable keys, reconciliation is key-based.
 * - Otherwise, it falls back to index-based (slot) reuse.
 *
 * Mutations are applied via setters/proxies so dirty tracking can skip frames
 * when nothing actually changed.
 */
export function reconcileTree(
  prev: ViewElement | undefined | null,
  next: ViewElement,
): ViewElement {
  if (!prev) return next;
  if (!canReuse(prev, next)) return next;

  syncCommonProps(prev, next);
  reconcileChildren(prev, next);
  syncLeafProps(prev, next);
  return prev;
}
