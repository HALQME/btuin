import { Block, type BlockElement } from "./block";

/**
 * Spacer is an empty flex item that expands to fill remaining space.
 * Useful in HStack/VStack as a flexible gap.
 */
export function Spacer(grow = 1): BlockElement {
  const el = Block();
  el.style.flexGrow = grow;
  el.style.flexShrink = 1;
  el.style.flexBasis = 0;
  return el;
}
