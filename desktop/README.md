# desktop/ — Zone isolée Windows (bureau)

Règle d'or : **tout ce qui concerne l'application bureau vit ici, et seulement ici.**
La racine du projet est 100 % web. L'agent qui travaille sur Windows ne sort jamais de ce dossier.

## Contenu

| Dossier | Rôle | Règle |
|---|---|---|
| `reference-web/` | Snapshot **figé** de l'app web au 27/10/2026 (sans `node_modules`, `.next`, `.git`, `.env.local`). Sert uniquement à **consulter** le code web. | Lecture seule. Ne jamais modifier. Fichiers en `chmod a-w`. |
| `windows/` | **Chantier Windows** : copie complète du projet + tout le code desktop (`electron/`, `lib/desktop/`, `types/desktop.d.ts`, route `/api/desktop/settings`, `desktop-api-key-card`, branches `DESKTOP`/`NEXT_PUBLIC_DESKTOP`). C'est ici que l'agent code, build et teste. | Seul dossier modifiable par l'agent desktop. |

## Isolation côté tooling racine

- `tsconfig.json` (racine) exclut `desktop` : le typecheck web ne voit jamais le chantier.
- `biome.jsonc` (racine) exclut `desktop` : le lint/format web ignore ce dossier.
- Preuve : `tsc --noEmit` à la racine sort en exit 0, zéro erreur (27/10/2026).

## Règles d'isolement (agent desktop)

1. Lire et écrire **uniquement** sous `desktop/`.
2. `reference-web/` : consultation seule (fichiers verrouillés en écriture).
3. `windows/` : a son propre `node_modules` (à installer), son `.desktop-data/`, ses builds. Ne jamais utiliser ceux de la racine.
4. Ne jamais copier `.env.local` (secrets) dans `desktop/`. Les clés de test se saisissent via les réglages de l'app (`settings.json`).
5. Ne jamais toucher à la racine du projet (`../`) : ni lecture pendant le chantier courant, ni écriture.

## Pour resynchroniser (humain uniquement)

Si l'app web a beaucoup évolué et que le chantier Windows a besoin d'une base fraîche :
1. Demander à l'agent web un point stable (racine sans code desktop).
2. `chmod -R u+w reference-web && rm -rf reference-web windows` puis refaire les deux copies (voir historique de cette session).
3. Réappliquer le `chmod -R a-w reference-web`.
