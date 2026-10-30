# CREATOR vs EMPLOYER — la vision produit

Il y a une règle fondamentale dans Employee, et tout le système est
construit pour la rendre **inviolable techniquement**, pas seulement
contractuelle :

> **Le Créateur définit l'ADN. L'Employeur recrute — il ne redéfinit pas.**

## Ce que fait le Créateur

Le Créateur est l'éditeur de métiers. Lui seul peut :

- **publier un profil** (`data-analyst@1.0.0`) : prompt système, outils
  autorisés, permissions, budget de pas — puis **épingler son empreinte**
  dans `profiles.lock.json` ;
- **publier un employé** en lui attachant une spécialisation exacte
  (`specialization: {name, version}`) — l'ADN, posé une fois, immuable ;
- **suspendre / réactiver** un employé (un suspendu ne peut plus runner).

```bash
# Route admin : scope "admin" requis, jamais donné aux employeurs
emp publish --name Aria --role "Data Analyst" --spec data-analyst@1.0.0
# employee: emp_9545…
```

Publier, c'est signer : « cet employé est un data-analyst v1.0.0, avec
exactement ces outils et ces permissions ». Cette promesse voyage avec
l'employé, d'un employeur à l'autre.

## Ce que fait l'Employeur

L'Employeur est le client du travail. Il peut :

- **recruter** un employé publié (`hire` → contrat `hire_...`, idempotent) ;
- **missionner** en langage naturel (`submit` → job suivi jusqu'au rapport) ;
- **suivre et annuler** (`status`, `events` en temps réel, `cancel`
  coopératif) ;
- **configurer l'environnement de travail** : le sandbox (données
  accessibles), les variables transmises au shell (PATH uniquement par
  défaut — les clés API de l'hôte ne fuient jamais), la mémoire de *son*
  scope.

```bash
emp hire emp_9545…
emp submit emp_9545… "Audit churn"
emp events job_e8bb…   # queued -> running -> succeeded + rapport
```

## Ce que l'Employeur ne peut PAS faire (garanti par le code)

Ce n'est pas une politique écrite dans un CGU, ce sont des erreurs
levées par le runtime :

| Tentative | Barrière technique |
|---|---|
| Changer le profil d'un employé | aucun setter : `specialization` immuable, migration explicite seule issue |
| Ajouter un outil au run | outils de l'appelant **ignorés** si l'employé est lié ; résolution depuis la spec exacte |
| Retirer un outil promis | même mécanisme : le run utilise exactement l'ADN, ni plus ni moins |
| Augmenter le budget de pas | `maxSteps > spec.maxSteps` → erreur avant le 1er appel LLM |
| Modifier un profil publié | specs + lockfile hors d'atteinte des routes employeur ; hash mismatch = refus |
| Lire la mémoire d'un autre tenant | partition `(employee, employer)` + filtrage à l'injection LLM |
| Missionner sans contrat | `submit` sans engagement actif → 403 |

## Pourquoi cette séparation ?

1. **Confiance transférable.** Si l'employeur pouvait redéfinir l'ADN, le
   label « data-analyst v1.0.0 » ne voudrait plus rien dire — et
   l'historique de l'employé ne serait plus une référence crédible pour
   le *prochain* employeur. L'immutabilité fonde la réputation.
2. **Moindre privilège par construction.** Un `researcher` sans shell le
   reste chez tous les employeurs : la sécurité suit l'employé, elle ne
   dépend pas de la discipline de chaque client.
3. **Responsabilités claires.** Métier cassé (mauvais prompt, mauvaise
   permission) → faute du Créateur, corrigeable en publiant `1.0.1`.
   Mission floue, données absentes → côté Employeur. Le rapport final dit
   toujours dans quel cadre le travail a été fait.

En une phrase : **le Créateur vend des métiers garantis, l'Employeur achète
du travail encadré — et le système empêche chacun de sortir de son rôle.**
