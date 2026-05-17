export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function getDevicePixelRatio(): number {
  if (typeof window === 'undefined') return 1;
  return window.devicePixelRatio || 1;
}

export function getOptimalRenderSize(containerSize: number): number {
  const mobile = isMobileDevice();
  const dpr = getDevicePixelRatio();

  if (mobile) {
    return Math.min(containerSize, 1024);
  }
  return Math.min(containerSize * Math.min(dpr, 2), 2048);
}

export function getOptimalParticleCount(baseCount: number): number {
  const mobile = isMobileDevice();
  return mobile ? Math.floor(baseCount * 0.4) : baseCount;
}
