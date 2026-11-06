// Landscape play on touch screens: the game takes the whole screen (the page
// bar hides, see `.is-immersive` in the game CSS) and, where the browser
// allows it, goes properly full screen on the player's next tap. If the player
// leaves full screen themselves, it is not requested again on this page.

export function landscapeTouchPlay(root: HTMLElement, playing: () => boolean): boolean {
  const on = playing() && root.classList.contains('is-touch') && !root.classList.contains('is-portrait');
  const was = root.classList.contains('is-immersive');
  root.classList.toggle('is-immersive', on);
  if (on && !was) root.scrollIntoView({ block: 'start' });
  return on;
}

export function autoFullscreen(root: HTMLElement): void {
  if (!document.fullscreenEnabled) return;
  let ours = false, declined = false;
  const go = () => {
    if (declined || document.fullscreenElement || !root.classList.contains('is-immersive')) return;
    ours = true;
    root.requestFullscreen({ navigationUI: 'hide' }).catch(() => { ours = false; });
  };
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement || !ours) return;
    ours = false;
    if (root.classList.contains('is-immersive')) declined = true;
  });
  // Both are user activations; the timeout lets a menu click switch modes first.
  root.addEventListener('pointerup', (e) => { if (e.pointerType === 'touch') go(); });
  root.addEventListener('click', () => setTimeout(go));
}
