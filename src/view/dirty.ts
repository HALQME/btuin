let layoutVersion = 0;
let renderVersion = 0;
let hasAnyScrollRegion = false;

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
