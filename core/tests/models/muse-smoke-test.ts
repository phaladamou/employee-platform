
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const { MuseProvider } =
  await import("../../models/providers/muse-provider");
  const provider = new MuseProvider();

  const result = await provider.generate({
    messages: [
      {
        role: "user",
        content: "Réponds simplement : Scientia Labs fonctionne.",
      },
    ],
    temperature: 0,
  });

  console.log("LLM result:");
  console.log(result);
}

main().catch((error) => {
  console.error("LLM smoke test failed:");
  console.error(error);
  process.exit(1);
});

