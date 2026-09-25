Synchronise la documentation IA (`CLAUDE.md` + `.claude/`) avec l'état réel du code.

## Étapes

1. **Trouver le dernier commit ayant touché la doc IA** :
   ```bash
   git log -1 --format="%H %s" -- .claude CLAUDE.md AGENTS.md
   ```

2. **Lister ce qui a changé dans le code depuis** :
   ```bash
   git diff <hash>..HEAD --stat -- backend/src backend/test backend/package.json docs
   ```
   S'il n'y a aucun changement, le dire et s'arrêter.

3. **Analyser les changements** et mettre à jour **uniquement ce qui a réellement évolué** :
   - `.claude/contexts/project_state.md` — tickets terminés/commencés, nouveaux modules, pièges découverts (**quasi systématique**)
   - `.claude/contexts/architecture.md` — nouvel ADR si une décision d'architecture a été prise (avec sa raison)
   - `CLAUDE.md` — seulement si un **invariant** a changé (nouvelle règle transverse, nouvelle commande npm, changement de stack). Le garder court : si un ajout dépasse 3 lignes, il va dans un fichier de `.claude/` et CLAUDE.md n'en garde que le pointeur
   - `.claude/patterns/` — si une convention de code a changé ou qu'un nouveau pattern de référence est apparu
   - `.claude/errors/` — si une erreur non triviale (> 15 min de debug) a été résolue pendant la période
   - `docs/backend/conventions.md` — signaler à l'utilisateur si une pratique du code contredit la doc d'équipe, mais **ne pas la modifier sans son accord** (c'est un document d'équipe)

4. **Ne pas inventer** : ne documenter que ce qui est visible dans le diff ou connu de la conversation. En cas de doute sur une intention, poser la question.

5. **Récapituler** les fichiers modifiés et proposer un commit `chore: synchronise la documentation IA (.claude)` — sans push.
