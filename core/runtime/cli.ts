import "dotenv/config";

import { createCore } from "./bootstrap";

import type { CoreHost } from "../contracts/host";
import type { CoreInput } from "../contracts/input";
import type { CoreEvent } from "../contracts/output";

async function main() {
  const objective = process.argv
    .slice(2)
    .join(" ")
    .trim();

  if (!objective) {
    throw new Error(
      "No mission provided. Pass the mission as a command-line argument."
    );
  }

  const { core } = createCore();

  const input: CoreInput = {
    userId: "cli-user",
    sessionId: "cli-session",
    currentChatId: "cli-chat",

    message: {
      id: "cli-message",
      role: "user",
      text: objective,

      parts: [
        {
          type: "text",
          text: objective,
        },
      ],

      attachments: [],
    },
  };

  const host: CoreHost = {
    async getConversation() {
      return [];
    },

    async getUserConversations() {
      return [];
    },

    async searchConversations() {
      return [];
    },

    async getDocument() {
      return null;
    },

    async createDocument() {
      throw new Error(
        "createDocument is not available in the Core CLI."
      );
    },

    async updateDocument() {
      throw new Error(
        "updateDocument is not available in the Core CLI."
      );
    },

    async editDocument() {
      throw new Error(
        "editDocument is not available in the Core CLI."
      );
    },

    async searchWeb() {
      throw new Error(
        "searchWeb must be provided by a Core capability."
      );
    },

    async getWeather() {
      throw new Error(
        "getWeather is not available in the Core CLI."
      );
    },

    async newsSearch() {
      throw new Error(
        "newsSearch must be provided by a Core capability."
      );
    },

    async saveMemory() {
      throw new Error(
        "Memory is not available in the Core CLI."
      );
    },

    async getMemories() {
      throw new Error(
        "Memory is not available in the Core CLI."
      );
    },

    async searchMemory() {
      throw new Error(
        "Memory is not available in the Core CLI."
      );
    },
  };

  console.log(
    "\n=========================================="
  );

  console.log(" CORE");

  console.log(
    "==========================================\n"
  );

  console.log(
    "Mission:",
    objective
  );

  console.log(
    "\nExecuting...\n"
  );

  // ---------------------------------------------------------------------
  // Capture des events émis par Core
  //
  // Chaque event est loggé au moment où il arrive, avec un timestamp
  // relatif au démarrage de la mission. Cela permet de vérifier :
  //   - que les agents émettent bien des CoreEvent
  //   - que l'ordre des events est préservé
  //   - que le streaming (text_delta) fonctionne
  // ---------------------------------------------------------------------

  const startedAt = Date.now();

  const onEvent = (event: CoreEvent) => {
    const elapsed = Date.now() - startedAt;

    const prefix = `[EVENT +${elapsed}ms]`;

    switch (event.type) {
      case "status":
        console.log(`${prefix} status: ${event.message}`);
        break;

      case "text_delta":
        // Pas de newline : on veut voir le texte se construire
        process.stdout.write(`${prefix} text_delta: ${event.text}\n`);
        break;

      case "reasoning_delta":
        console.log(
          `${prefix} reasoning_delta: ${event.text}`
        );
        break;

      case "tool_started":
        console.log(
          `${prefix} tool_started: ${event.toolName} (${event.toolCallId})`
        );
        break;

      case "tool_result":
        console.log(
          `${prefix} tool_result: ${event.toolCallId}`
        );
        break;

      case "environment_result":
        console.log(
          `${prefix} environment_result: ${event.requestId}`
        );
        break;

      case "artifact":
        console.log(
          `${prefix} artifact: ${event.artifact.title}`
        );
        break;

      case "done":
        console.log(`${prefix} done`);
        break;

      case "error":
        console.error(`${prefix} error: ${event.message}`);
        break;
    }
  };

  const result = await core.request(
    input,
    host,
    onEvent
  );

  console.log(
    "\n=========================================="
  );

  console.log(" CORE RESULT");

  console.log(
    "==========================================\n"
  );

  console.dir(result, {
    depth: null,
  });
}

main().catch((error) => {
  console.error(
    "\n[Core] FAILED\n",
    error
  );

  process.exit(1);
});