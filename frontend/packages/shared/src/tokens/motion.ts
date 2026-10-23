/** Durées en millisecondes ; reduced motion désactive toutes les durées. */
export const motion = {
  duration: { instant: 120, snap: 180, signature: 320, sequence: 400 },
  easing: 'cubic-bezier(0.2,0,0,1)',
  reducedDuration: 0,
} as const;
