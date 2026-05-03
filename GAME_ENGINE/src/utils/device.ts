export function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const touchPoints = (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints ?? 0;
  return /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(ua) || touchPoints > 1;
}

export function isPortrait(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerHeight >= window.innerWidth;
}

export function getOrientation(): 'portrait' | 'landscape' {
  return isPortrait() ? 'portrait' : 'landscape';
}
