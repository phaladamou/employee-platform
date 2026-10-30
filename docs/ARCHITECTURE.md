# ARCHITECTURE — le cœur technique

Ce document explique comment le système est découpé, ce qui distingue un
employé d'un contrat de travail, et comment une mission traverse le
système de bout en bout.

## Les 3 couches

```
┌──────────────────────────────────────────────────────────────┐
│ 3. CLI  core/employee/cli/ + cli.ts                          │
│    Parse argv, construit le contexte, parle au serveur.       │
│    Seul endroit qui lit process.env (clés, URLs, chemins).   │
└──────────────────────────┬───────────────────────────────────┘
                           │ HTTP REST /v1 + SSE
┌──────────────────────────▼───────────────────────────────────┐
│ 2. Serveur  core/employee/server/  (+ sdk/)                   │
│    Handler pur (routes + auth) • adaptateur node:http        │
│    Boucle worker (claim -> exécution -> clôture)             │
└──────────────────────────┬───────────────────────────────────┘
                           │ appels directs, types partagés
┌──────────────────────────▼───────────────────────────────────┐
│ 1. Noyau  core/employee/                                     │
│    Pur : TypeScript seul, aucun import React/Next/Electron,  │
│    aucune lecture d'env, config toujours injectée.           │
│    Testé en isolation (vitest), exécutable sans le reste.    │
└──────────────────────────────────────────────────────────────┘
```

**Pourquoi cette séparation ?** Le noyau contient toutes les décisions
métier (qui peut quoi, transitions légales, isolation). L'API et la CLI
ne font que transporter : même logique, trois portes d'entrée (in-process,
HTTP, terminal). On peut remplacer le transport sans toucher au métier —
et tester le métier sans réseau.

Concrètement, `InProcessEmployeeClient` et `HttpEmployeeClient`
implémentent la **même interface** `EmployeeClient` : le code qui recrute
et missionne ne sait pas (et ne doit pas savoir) s'il parle à des objets
locaux ou à un serveur distant.

## Employee vs Employment : ne pas confondre

C'est la distinction la plus importante du modèle.

**Employee — l'identité persistante** (`emp_...`)

```ts
{
  id: "emp_9545…",
  name: "Aria",
  role: "Data Analyst",
  skills: ["SQL", "forecasting"],
  status: "idle",
  specialization: { name: "data-analyst", version: "1.0.0" }  // ADN
}
```

L'employé existe indépendamment de tout employeur. Son identité est
permanente, son ADN (spécialisation + version exacte) est immuable :
aucune API ne permet de le modifier après publication. C'est ce qui rend
sa réputation transférable : demain, un autre employeur pourra recruter
*le même* `emp_9545…` avec son historique vérifiable.

**Employment — le contrat** (`hire_...`)

```ts
{
  id: "hire_800a…",
  employeeId: "emp_9545…",
  employerId: "acme",
  hiredAt: "2026-…",
  terminatedAt: null
}
```

L'engagement est une **relation séparée** : il lie un employé à un
employeur, pour une période. Propriétés :

- `hire` est **idempotent** : recruter deux fois le même employé retourne
  le même contrat, sans doublon.
- `terminate` résilie le contrat **sans détruire** ni l'employé ni son
  historique (facturation, audit, références futures).
- Soumettre une mission exige un engagement **actif** : sans contrat, pas
  de travail (le serveur répond 403).

Analogie : l'Employee est la personne (passeport permanent), l'Employment
est le contrat de travail (CDD/CDI, résiliable). On ne supprime jamais la
personne quand le contrat se termine.

## Cycle de vie d'une mission

Une mission utilisateur devient un **job** traçable. États :

```
                    ┌──────────┐
   submit           │  queued  │  en attente, annulable
      └────────────►│          │  immédiatement (cancel direct)
                    └────┬─────┘
                         │ claim atomique (un seul worker gagne)
                    ┌────▼─────┐
                    │ running  │  verrouillé par lockOwner
                    └────┬─────┘
           ┌─────────────┼──────────────┐
           │             │              │ cancel (employeur)
      ┌────▼─────┐ ┌─────▼────┐ ┌───────▼──────────────┐
      │succeeded │ │  failed  │ │cancellation_requested│
      │+ rapport │ │ + erreur │ └──────────┬───────────┘
      └──────────┘ └──────────┘            │ le worker s'interrompt
                                           │ au prochain pas, puis confirme
                                      ┌────▼─────┐
                                      │cancelled │
                                      └──────────┘
```

Points de conception :

1. **File at-least-once.** Le `claim` passe par un fichier verrou créé en
   mode exclusif : face à N workers (même sur des processus séparés), un
   seul obtient le job. Revers assumé et documenté : un worker qui meurt en
   `running` laisse le job verrouillé (pas de TTL ni heartbeat — reprise
   manuelle).
2. **Annulation coopérative, jamais brutale.** On ne tue pas un run en
   cours : l'employeur demande (`cancellation_requested`), le worker
   observe le signal avant chaque pas LLM, s'interrompt proprement, puis
   confirme (`cancelled`). Un job annulé se distingue toujours d'un job
   en échec — y compris dans la mémoire de l'employé.
3. **Mission et job sont liés mais distincts.** La mission porte le prompt
   et le rapport métier ; le job porte l'ordonnancement (file, verrou,
   annulation). Le worker fait le pont : `runClaimedJob` charge la
   mission + le profil, exécute le runtime, persiste le résultat des deux
   côtés.
4. **Mémoire scopée.** Chaque mission terminée est archivée sous la clé
   `(employeeId, employerId)` et rappelée au LLM **uniquement dans ce
   scope** : l'expérience accumulée chez Acme n'est jamais injectée dans
   une mission pour Globex (voir [SECURITY.md](SECURITY.md)).

Exemple réel (E2E validé avec Muse) :

```
$ emp submit emp_e7f8… "Crée hello.txt avec 'bonjour' dedans et relis-le."
job: job_e8bb… (queued)
$ emp events job_e8bb…
job: job_e8bb… (queued)
job: job_e8bb… (running)
job: job_e8bb… (succeeded)
report: Fichier hello.txt créé avec 'bonjour' (7 bytes écrits,
        vérifié par relecture: 'bonjour').
```
