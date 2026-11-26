import { createRef } from 'react';

import { describe, expect, it, vi } from 'vitest';

import { assignRef } from './assignRef';

describe('assignRef', () => {
  it('remplit une référence objet', () => {
    const ref = createRef<string>();

    assignRef(ref, 'champ');

    expect(ref.current).toBe('champ');
  });

  it('appelle une référence fonction', () => {
    const ref = vi.fn();

    assignRef(ref, 'champ');

    expect(ref).toHaveBeenCalledWith('champ');
  });

  it('ne fait rien sans référence', () => {
    expect(() => assignRef(undefined, 'champ')).not.toThrow();
  });
});
