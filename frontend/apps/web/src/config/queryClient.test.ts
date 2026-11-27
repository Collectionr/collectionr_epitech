import { describe, expect, it } from 'vitest';

import { QUERY_KEYS } from '@shared/constants';
import { TEST_USER } from '@shared/hooks/mocks/createAuthHarness';

import { authService } from './api';
import { queryClient } from './queryClient';

describe('queryClient de l’application web', () => {
  it('est vidé quand la session de l’application se ferme', () => {
    authService.store.getState().startSession(TEST_USER, 'acces-1');
    queryClient.setQueryData(QUERY_KEYS.collections, ['Base']);

    authService.store.getState().endSession({ reason: 'expired' });

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });
});
