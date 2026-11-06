/**
 * The code in a share link (/p/<code>/): short and opaque, so the address
 * doesn't say which project it opens. Worked out from the slug (FNV-1a, base
 * 36), so a project keeps the same link from build to build. DOM-free: shared
 * by the build and the tests.
 */
export function shareCode(slug: string) {
  let h = 0x811c9dc5;
  for (const ch of `randybuilds-share:${slug}`) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  return (h + 36 ** 6).toString(36); // always seven characters
}
