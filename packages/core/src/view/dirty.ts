let layoutVersion = 0;
let renderVersion = 0;
let hasAnyScrollRegion = false;

// Per-node dirty tracking for incremental layout
const nodeDirtyVersions = new Map<string, number>();
const nodeLayoutVersions = new Map<string, number>();

export function markLayoutDirty(): void {
  layoutVersion++;
  renderVersion++;
}

export function markRenderDirty(): void {
  renderVersion++;
}

export function markHasScrollRegion(): void {
  hasAnyScrollRegion = true;
}

export function getHasScrollRegion(): boolean {
  return hasAnyScrollRegion;
}

export function getDirtyVersions(): { layout: number; render: number } {
  return { layout: layoutVersion, render: renderVersion };
}

export function setDirtyVersions(versions: { layout: number; render: number }): void {
  layoutVersion = versions.layout;
  renderVersion = versions.render;
}

// Per-node dirty tracking
export function markNodeLayoutDirty(nodeId: string): void {
  nodeLayoutVersions.set(nodeId, layoutVersion);
}

export function isNodeLayoutDirty(nodeId: string): boolean {
  const lastVersion = nodeLayoutVersions.get(nodeId);
  return lastVersion === undefined || lastVersion < layoutVersion;
}

export function getNodeLayoutVersion(nodeId: string): number {
  return nodeLayoutVersions.get(nodeId) ?? 0;
}

export function setNodeLayoutVersion(nodeId: string, version: number): void {
  nodeLayoutVersions.set(nodeId, version);
}

export function clearNodeDirtyTracking(): void {
  nodeLayoutVersions.clear();
  nodeDirtyVersions.clear();
}

// Reset function for testing - DO NOT use in production
export function resetDirtyTracking(): void {
  layoutVersion = 0;
  renderVersion = 0;
  hasAnyScrollRegion = false;
  clearNodeDirtyTracking();
}
