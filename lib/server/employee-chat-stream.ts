// lib/server/employee-chat-stream.ts
// Reponse chat en streaming (tokens live) pour l'interface de
// discussion Atlas. Fichier neuf et isole : le pont missions
// (run-web-mission.ts) et le workspace ne sont pas touches.
// La resolution provider ci-dessous est le miroir exact de
// resolveProvider() : meme variable EMPLOYEE_PROVIDER, memes cles,
// meme modele. Si l'un change, changer l'autre.
import "server-only";

import { pipeSSEToText } from "./sse-parse";

interface StreamConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

function resolveStreamConfig(): StreamConfig {
  const providerName = (
    process.env.EMPLOYEE_PROVIDER ?? "deepseek"
  ).toLowerCase();
  if (providerName === "muse" || providerName === "meta") {
    const apiKey = process.env.MUSE_API_KEY;
    if (!apiKey) {
      throw new Error("MUSE_API_KEY is missing");
    }
    return {
      apiKey,
      baseUrl: process.env.MUSE_BASE_URL ?? "https://api.meta.ai/v1",
      model: process.env.MUSE_MODEL ?? "muse-spark-1.3",
    };
  }
  if (providerName === "deepseek") {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error("DEEPSEEK_API_KEY is missing");
    }
    return {
      apiKey,
      baseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
      model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
    };
  }
  throw new Error(`Unknown EMPLOYEE_PROVIDER "${providerName}"`);
}

function systemPrompt(name: string, role: string): string {
  // Meme identite que le chat JSON (chatWithEmployee).
  return `You are ${name}, ${role} at Employee. Answer concisely in the user's language. You are an AI employee, never claim to be human.`;
}

export async function streamEmployeeReply(input: {
  name: string;
  role: string;
  message: string;
}): Promise<Response> {
  const config = resolveStreamConfig();
  const url = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;

  const upstream = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt(input.name, input.role) },
        { role: "user", content: input.message },
      ],
      temperature: 0.3,
      // Garde-fou latence : le chat doit rester concis, on coupe
      // la queue des reponses trop longues au lieu de streamer
      // pendant 30 s. Ajustable si les reponses sont tronquees.
      max_tokens: 800,
      stream: true,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    throw new Error(`LLM stream failed: HTTP ${upstream.status}`);
  }

  return new Response(pipeSSEToText(upstream.body), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      // Anti-buffering : certains proxys attendraient la fin du
      // flux avant de transmettre, tuant le streaming percu.
      "x-accel-buffering": "no",
    },
  });
}
