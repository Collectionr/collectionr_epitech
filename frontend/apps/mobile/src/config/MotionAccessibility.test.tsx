import { AccessibilityInfo } from 'react-native';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, waitFor } from '@testing-library/react-native';
import { ReducedMotionConfig, ReduceMotion } from 'react-native-reanimated';

import { MotionAccessibility } from '@/config/MotionAccessibility';

jest.mock('react-native-reanimated', () => ({
  ReducedMotionConfig: jest.fn(() => null),
  ReduceMotion: { Always: 'always', Never: 'never' },
  useReducedMotion: () => false,
}));

const accessibilityEvents: {
  addEventListener(
    event: 'reduceMotionChanged',
    handler: (enabled: boolean) => void,
  ): { remove(): void };
} = AccessibilityInfo;

describe('MotionAccessibility', () => {
  let onChange: (enabled: boolean) => void;
  const remove = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(accessibilityEvents, 'addEventListener').mockImplementation((event, handler) => {
      expect(event).toBe('reduceMotionChanged');
      onChange = handler;
      return { remove };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('applique la préférence initiale, suit ses changements et retire son abonnement', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const view = await render(<MotionAccessibility />);

    await waitFor(() =>
      expect(ReducedMotionConfig).toHaveBeenLastCalledWith(
        { mode: ReduceMotion.Always },
        undefined,
      ),
    );
    await act(() => onChange(false));
    expect(ReducedMotionConfig).toHaveBeenLastCalledWith({ mode: ReduceMotion.Never }, undefined);
    await act(() => onChange(true));
    expect(ReducedMotionConfig).toHaveBeenLastCalledWith({ mode: ReduceMotion.Always }, undefined);
    await view.unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('ne remplace pas une préférence récente par une réponse initiale tardive', async () => {
    let resolveInitial: (enabled: boolean) => void = () => {
      throw new Error('Lecture non démarrée');
    };
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolveInitial = resolve;
        }),
    );
    const view = await render(<MotionAccessibility />);
    await act(() => onChange(true));
    await act(async () => {
      resolveInitial(false);
    });
    expect(ReducedMotionConfig).toHaveBeenLastCalledWith({ mode: ReduceMotion.Always }, undefined);
    await view.unmount();
  });

  it('désactive les animations si la lecture système échoue', async () => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockRejectedValue(new Error('Indisponible'));
    const view = await render(<MotionAccessibility />);
    await waitFor(() =>
      expect(ReducedMotionConfig).toHaveBeenLastCalledWith(
        { mode: ReduceMotion.Always },
        undefined,
      ),
    );
    await view.unmount();
  });
});
