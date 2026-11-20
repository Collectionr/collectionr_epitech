import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Démonte les rendus de Testing Library après chaque test. Testing Library ne le fait seul que
// si `afterEach` est global, ce qui n'est pas le cas ici (Vitest tourne sans `globals`).
afterEach(() => {
  cleanup();
});
