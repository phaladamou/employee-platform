# Models — EmployeeCore

How Employee integrates Meta's models today, how new ones plug in,
and where the model stack goes next. Written for the Meta Global AI
Developer Hackathon (Oct 26 – Nov 4, 2026) and kept as the living
record afterwards.

Rule of the house: the **trade** (Employee DNA: tools, permissions,
step budget) is the unit of trust — not the model. Every model below
runs the same DNA through the same ReAct loop; swapping models never
changes what an employee is allowed to do.

## 1. What runs today

| Workload | Model | How |
|---|---|---|
| Agent missions (ReAct loop) | **Muse Spark 1.3** (`muse-spark-1.3`) via the Meta Model API | `EMPLOYEE_PROVIDER=muse`, `MUSE_API_KEY`, `MUSE_BASE_URL=https://api.meta.ai/v1` |
| Agent missions (fallback lab) | DeepSeek (`deepseek-chat`) | `EMPLOYEE_PROVIDER=deepseek`, `DEEPSEEK_API_KEY` |
| Web chat streaming | Muse Spark 1.3, `reasoning_effort=minimal` (~2.3 s to first token) | same Meta Model API key |

Every live run quoted in the README — T1–T7, the Atlas N=4
benchmarks, the GitHub fork → PR demo — executed on Muse Spark 1.3.

## 2. How a model plugs in (no code change)

The core talks to exactly one interface (`FetchLLMProvider`):
`{ apiKey, baseUrl, model }` → `POST {baseUrl}/chat/completions`
(OpenAI-compatible). Adding a provider is configuration, not code:

```bash
# Any OpenAI-compatible endpoint follows the same three variables.
EMPLOYEE_PROVIDER=muse            # or deepseek today; baseten next ( §4)
MUSE_API_KEY=...
MUSE_BASE_URL=https://api.meta.ai/v1
MUSE_MODEL=muse-spark-1.3
```

The web chat keeps its own registry (`lib/ai/models.ts`) for UI
model picking; the agent loop only ever sees the provider above.
Consequence: an eval-gated model swap is a config diff + the
calibration suite — never a rewrite.

## 3. Meta's model family in this project

- **Muse Spark 1.3** (frontier, Meta Model API): production
  missions today. 1 M-token context, built for reasoning, coding,
  and agent work — the ReAct loop's native workload.
- **Muse Glimmer 30B** (Apache 2.0, open weights on Hugging Face):
  Meta's open counterweight. Target: self-hosted inference for
  sovereign deployments and cost-sensitive workloads (§4).
- **Llama 4 Scout & Maverick** (open weights): the MoE herd
  (Scout 17 B active / 109 B, 10 M context; Maverick 17 B active /
  400 B, 1 M context). Meta's hosted Llama API shut down in July
  2026, so they live on self-hosted rails — same Baseten path as
  Glimmer.

## 4. Baseten: the open-models rail (planned, mechanics known)

Baseten is the intended serving layer for every open Meta model in
this project (Glimmer, Llama 4). Two shapes, both OpenAI-compatible,
both pluggable into §2 with zero core changes:

1. **Model APIs** (fastest): call hosted open models through
   Baseten's OpenAI-compatible Chat Completions endpoint — base URL
   + `BASETEN_API_KEY`, same three-variable pattern.
2. **Dedicated deployments** (sovereign): ship Glimmer/Llama 4 to
   Baseten on dedicated infra via Truss (`baseten model push`);
   engine-based deployments expose `/v1/chat/completions`, so the
   provider config just points at the deployment URL.

Planned rollout, in order:

1. Deploy Muse Glimmer 30B on Baseten (dedicated).
2. Run the 12 calibration missions + T1–T7 against it; publish the
   delta vs Muse Spark 1.3 (success rate, tokens, wall time).
3. Graduate Glimmer to cost-sensitive workloads first (judges,
   classifiers, summaries), frontier keeps plan-and-act until the
   evals say otherwise.
4. Same path for Llama 4 Maverick (long-context missions) and
   Scout (10 M-context specialist).

Status: not wired yet — the provider interface already accepts it,
the eval harness (§5) decides when it lands.

## 5. How new models keep landing (the ongoing process)

1. **Same interface, always.** Any Meta (or third-party) release
   that speaks OpenAI-compatible chat completions plugs into §2.
2. **Eval-gated graduation.** No model touches production missions
   before the calibration suite (12 missions, 2 per employee) +
   the T1–T7 live runs pass on it. Numbers land in TESTING.md next
   to the Spark baseline.
3. **Routing by task, not by hype.** Trajectory: frontier models
   (Spark-class) for plan-and-act loops; smaller open models
   (Glimmer-class, Baseten-served) for judges, intent routing,
   summaries, and embeddings; long-context models (Scout-class)
   for repo-scale missions. The router will be a declared
   per-profile default, overridable per mission — never magic.
4. **Cost ledger per mission.** Token usage is already captured per
   run; next step is per-mission cost attribution so employer
   dashboards can compare models on price per verified success,
   not vibes.
5. **Checkpoints stay portable.** Fine-tuned or distilled
   checkpoints (employer-specific behavior) deploy through the
   same Baseten dedicated path — one serving story for base and
   custom models.

When in doubt: a model earns production traffic with evals, keeps
it with the cost ledger, and never changes the DNA.
