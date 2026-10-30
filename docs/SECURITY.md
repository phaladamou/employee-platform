# SECURITY — le modèle de sécurité

Ce document décrit les trois piliers : les clés d'accès, l'intégrité des
profils (lockfile) et l'isolation stricte entre employeurs.

## 1. Deux familles de clés : `emk_` vs `emo_`

Le préfixe n'est pas cosmétique : il empêche de confondre une clé secrète
avec un identifiant public (`emp_...`) et sépare deux autorités.

|  | `emk_` (employé) | `emo_` (employeur) |
|---|---|---|
| Porte sur | un Employee (`emp_...`) | un tenant (`employerId`) |
| Sert à | authentifier l'employé lui-même | appeler l'API au nom d'un employeur |
| Utilisé par | le runtime / les délégations futures | CLI, SDK HTTP, intégrations |
| Exemple | `emk_a91F…` | `emo_YVWX…` |

Propriétés communes (les deux familles) :

- **32 octets aléatoires** (`crypto.randomBytes`), encodés base64url.
- **Hash seul stocké** (SHA-256) : le token en clair n'est montré qu'une
  fois, à l'émission. Voler la base ne donne aucun accès.
- **Fichiers `chmod 600`** : lisibles uniquement par le propriétaire.
- **Expiration (TTL)** et **révocation** : une clé meurt sans toucher à
  l'identité qu'elle représente. Révoquer, c'est couper l'accès, pas
  supprimer l'employé ni l'employeur.
- **Scopes** : `missions:submit`, `missions:read`, `memory:read`,
  `employments:read`, `employments:write`, `admin`. Chaque route exige son
  scope ; un token lecture seule obtient 401 sur les écritures — avec le
  **même message** qu'un token inexistant (pas d'oracle : on ne révèle ni
  l'existence d'une clé, ni le scope manquant).

```bash
$ emp keys issue --employer acme --label prod
id: emcred_e9f1…
token: emo_YVWX…        # affiché UNE fois, puis hashé au repos
scopes: missions:submit,missions:read,…
$ emp keys revoke emcred_e9f1…   # effet immédiat
```

## 2. Le lockfile : des profils infalsifiables

Un profil (`data-analyst@1.0.0`) définit ce qu'un employé **peut** faire :
outils autorisés, permissions, prompt système, nombre de pas max. Si un
attaquant modifiait `researcher.json` pour ajouter `run_shell`, un employé
« sans shell » exécuterait des commandes. Le lockfile ferme cette porte.

**Mécanisme** (`profiles.lock.json`, à côté des profils) :

```json
{
  "version": 1,
  "profiles": {
    "data-analyst@1.0.0": "sha256:9f2c…",
    "researcher@1.0.0": "sha256:41ab…"
  }
}
```

Au chargement, le registre recalcule l'empreinte SHA-256 du **contenu
canonique** de chaque spec et la compare au lockfile :

- spec absente du lockfile → **refus franc** ;
- contenu différent d'un seul octet → **refus franc** ;
- lockfile lui-même absent ou invalide → **refus franc**.

Le Créateur régénère le lockfile via `createProfileLockfile` quand il
publie une nouvelle version — jamais l'Employeur, qui n'a aucune route
pour toucher aux specs.

**Limites assumées** (documentées, pas cachées) :

- Le lockfile protège contre les **accidents et modifications** (édition
  fautive, corruption disque), pas contre un attaquant qui aurait déjà le
  droit d'écrire le lockfile lui-même : dans ce cas, il réépinglerait ses
  propres hashes. La parade prévue (signatures Ed25519 du Créateur) est
  réservée à la distribution distante.
- `verify: false` existe pour le développement local uniquement — jamais
  en production.

## 3. Isolation stricte : `employerId` partout, fui nulle part

Règle d'or : **le tenant est dérivé du token vérifié, jamais du body ni
de l'URL.** Aucun appelant ne peut dire « agis pour Acme » : c'est sa clé
qui le prouve, et le serveur qui en déduit `employerId`.

Concrètement, sur chaque lecture sensible :

```ts
// Pseudo-code du pattern appliqué aux jobs, missions, engagements…
const job = await jobs.loadScoped(employerIdDuToken, jobId);
if (!job) return 404;   // inconnu OU étranger : même réponse
```

- **404 indistinguable** : demander le job d'un autre employeur répond
  exactement comme un job inexistant. Pas de fuite d'existence, pas
  d'énumération.
- **Listes toujours scopées** : `listByEmployer` ne voit qu'un tenant.
  Seul le worker infra (jamais exposé aux clients) balaie tous tenants
  via `claimNext`.
- **Mémoire partitionnée** : fichiers `employee_<id>/employer_<e>.json`,
  et surtout **filtrage à l'injection** — le test cross-employer prouve
  que l'historique Acme n'apparaît jamais dans le prompt système d'une
  mission Globex. (Archives pré-scopes `employerId: null` : lisibles
  partout, cas legacy documenté.)
- **Soumission gardée** : `submit` exige un engagement actif *entre cet
  employé et ce tenant*, sinon 403.

Ce qui est vérifié par les tests (pas seulement affirmé) :

- un second client (autre employeur, mêmes stores) obtient `null`/`404`
  sur status, mission, cancel, events, listes ;
- le flux SSE d'un job étranger est refusé avant le premier octet ;
- un token révoqué ou expiré meurt immédiatement, avec un 401 identique
  au token inexistant.

## Ce qui reste volontairement hors scope

- Chiffrement au repos au-delà des permissions fichiers (à confier au
  volume chiffré de l'hôte).
- Rate limiting API (structure prête côté throttling OTP du web, pas
  encore sur `/v1`).
- Audit log des accès (les stores versionnent `createdAt`/transitions,
  pas les lectures).
