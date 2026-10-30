# profiles/ — Specialisations versionnees

Ce dossier contient les specialisations publiees par le **Createur**
(`*.json`) et leur **lockfile d'integrite** (`profiles.lock.json` :
`nom@version` -> SHA-256 du contenu canonique).

## Modele de confiance

- Le chargeur (`loadProfileRegistry`) est strict par defaut : lockfile
  absent, profil non epingle ou contenu different => erreur franche.
  C'est la frontiere de confiance (l'aval fait confiance aux objets
  verifies).
- Le lockfile **colocalise** protege contre les accidents, la corruption
  et les modifications silencieuses. Il ne protege PAS contre un
  attaquant avec acces en ecriture (il reecrirait le lockfile aussi).
- Plateforme : pointez `trust.lockfilePath` vers un emplacement
  read-only (bundlé, volume monte, secret manager).
- La protection contre un attaquant distant exige des **signatures**
  (cle Createur hors-ligne, verification dans le noyau) : prevu pour
  la Phase 3 (distribution distante), volontairement absent ici.
- `trust.verify: false` = confiance explicite de l'hote, DEV
  UNIQUEMENT. Jamais en production.

## Publier / modifier un profil (Createur uniquement)

1. Editer ou ajouter le `*.json` (respecter le contrat
   `EmployeeProfileSpec` : name, version semver, role, systemPrompt,
   allowedTools, permissions, maxSteps).
2. Bumper la version a chaque changement semantique.
3. Regenerer le lockfile via `createProfileLockfile(dossier)`
   (le contenu actuel devient la reference).
4. Ne JAMAIS editer `profiles.lock.json` a la main.

## Fichiers

- `profile-spec.ts` — contrat + garde de forme.
- `profile-registry.ts` — registre, chargeur verifiant, createur de lockfile.
- `profile-integrity.ts` — JSON canonique + SHA-256 (pur, zero dependance).
- `data-analyst.json`, `researcher.json` (sans shell),
  `software-engineer.json` — profils livres v1.0.0.
