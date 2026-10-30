# PROFILES — le catalogue des compétences

Un profil est un **métier versionné** : il définit ce qu'un employé sait
faire, avec quels outils, sous quelles permissions, et combien de pas de
raisonnement au maximum. Le profil est l'ADN ; l'employé en est une
instance vivante.

## Anatomie d'un profil versionné

`data-analyst@1.0.0` (fichier `core/employee/profiles/data-analyst.json`) :

```json
{
  "name": "data-analyst",
  "version": "1.0.0",
  "role": "Data Analyst",
  "systemPrompt": "You are a senior data analyst. Explore datasets…",
  "allowedTools": ["read_file", "write_file", "run_shell"],
  "permissions": ["fs:read", "fs:write", "shell:exec"],
  "maxSteps": 12
}
```

Chaque champ a un rôle d'exécution, pas décoratif :

| Champ | Rôle |
|---|---|
| `name` + `version` | identité exacte, épinglée dans le lockfile et dans l'ADN de l'employé |
| `role`, `systemPrompt` | contexte métier injecté au LLM (encadré, ne prime jamais sur les règles runtime) |
| `allowedTools` | outils résolvables pour ce profil — tout autre outil est rejeté |
| `permissions` | droits exigés de chaque outil (`fs:read`, `fs:write`, `shell:exec`) |
| `maxSteps` | budget de pas LLM ; le run peut demander *moins*, jamais plus |

**Versionnage strict** : l'employé est lié à `nom@version exacte`, jamais à
« latest ». Publier `data-analyst@1.1.0` ne change rien aux employés liés à
`1.0.0` — reproductibilité garantie. Changer l'ADN passe par une migration
explicite (nouvel objet, même `id`), jamais par une mutation silencieuse.

## Le catalogue actuel (3 profils)

### data-analyst@1.0.0 — l'analyste complet

- Outils : `read_file`, `write_file`, `run_shell`
- Permissions : `fs:read`, `fs:write`, `shell:exec`
- Budget : 12 pas
- Usage : explorer des données, calculer, produire des chiffres ancrés
  dans des observations outils (jamais inventés — c'est écrit dans son
  prompt système).

### researcher@1.0.0 — le chercheur sans shell

- Outils : `read_file`, `write_file` (**pas de `run_shell`**)
- Permissions : `fs:read`, `fs:write`
- Budget : 10 pas
- Usage : lire, synthétiser, citer ses sources par chemin de fichier.
  C'est le profil de démonstration du principe du moindre privilège : même
  si la mission le demande, il ne peut pas exécuter de commandes.

### software-engineer@1.0.0 — l'ingénieur pragmatique

- Outils : `read_file`, `write_file`, `run_shell`
- Permissions : `fs:read`, `fs:write`, `shell:exec`
- Budget : 16 pas (le plus large — implémenter + vérifier prend des pas)
- Usage : implémenter ce que la mission demande, lancer des vérifications
  via les outils, ne déclarer terminé qu'après vérification autonome.

## Fail Fast : comment le runtime applique les permissions

Au démarrage de chaque run — **avant le premier appel LLM** — le runtime
résout les outils via `resolveToolsForProfile` :

```
employé lié ? ── non ──► comportement généraliste (outils fournis)
    │
    oui : résoudre "nom@version exacte" dans le registre
    │
    ├─ spec inconnue ──────────────► ERREUR (pas de run)
    ├─ outil du profil inconnu ────► ERREUR (pas de run)
    ├─ outil sans la permission ───► ERREUR (pas de run)
    ├─ maxSteps demandé > budget ──► ERREUR (pas de run)
    │
    └─ tout est carré ──► run avec EXACTEMENT ces outils
         (les outils fournis par l'appelant sont ignorés :
          un employeur ne peut ni omettre ni substituer l'ADN)
```

Exemple concret : un employé lié à `researcher@1.0.0` reçoit la mission
« lance les tests avec `npm test` ». Le runtime résout `[read_file,
write_file]`, `run_shell` n'est pas résolu, le LLM ne le voit même pas
dans son catalogue — et s'il tente quand même `ACTION: run_shell`, la
boucle répond `unknown tool` en observation. L'interdiction est
structurelle, pas une consigne que le modèle pourrait ignorer.

C'est le sens de **Fail Fast** (option validée contre l'alternative
« dégrader silencieusement ») : tout écart entre l'ADN promis et
l'environnement réel lève franchement, avant de dépenser un seul token —
plutôt que de laisser un employé travailler avec des moyens qu'on ne lui
a pas promis.
