/** The `count` items after `item` in a circular list (none if it isn't there). DOM-free: shared by the build and the browser. */
export function nextAfter<T>(list: readonly T[], item: T, count: number): T[] {
  const i = list.indexOf(item);
  if (i < 0) return [];
  return Array.from({ length: Math.min(count, list.length - 1) }, (_, k) => list[(i + 1 + k) % list.length]);
}
