import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// Les pages sont chargées à la demande (lazy) et transformées par Vite à leur premier import :
// dans un worker froid, sous la charge de la suite complète, cela dépasse parfois la seconde
// d'attente par défaut des requêtes `findBy`. Ce délai ne ralentit que les tests qui échouent.
configure({ asyncUtilTimeout: 3000 });

// Démonte les rendus de Testing Library après chaque test. Testing Library ne le fait seul que
// si `afterEach` est global, ce qui n'est pas le cas ici (Vitest tourne sans `globals`).
afterEach(() => {
  cleanup();
});
