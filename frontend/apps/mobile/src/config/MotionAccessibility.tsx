import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { ReducedMotionConfig, ReduceMotion, useReducedMotion } from 'react-native-reanimated';

/** Synchronise une fois à la racine la préférence système avec toutes les animations Reanimated. */
export function MotionAccessibility() {
  const initialPreference = useReducedMotion();
  const [reduceMotion, setReduceMotion] = useState(initialPreference);

  useEffect(() => {
    let active = true;
    let receivedChange = false;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      receivedChange = true;
      setReduceMotion(enabled);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then(
      (enabled) => {
        if (active && !receivedChange) setReduceMotion(enabled);
      },
      () => {
        if (active && !receivedChange) setReduceMotion(true);
      },
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return <ReducedMotionConfig mode={reduceMotion ? ReduceMotion.Always : ReduceMotion.Never} />;
}
