// lib/ai/tools/create-document.ts
import { tool, type UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import {
  artifactKinds,
  documentHandlersByArtifactKind,
} from "@/lib/artifacts/server";
import type { ChatMessage } from "@/lib/types";
import { generateUUID } from "@/lib/utils";

type CreateDocumentProps = {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  modelId: string;
  chatId?: string;
};

export const createDocument = ({
  session,
  dataStream,
  modelId,
  chatId,
}: CreateDocumentProps) =>
  tool({
    description:
      "Create an artifact. You MUST specify kind: use 'code' for any programming/algorithm request (creates a script), 'text' for essays/writing (creates a document), 'sheet' for spreadsheets/data, 'site' for websites/landing pages (creates HTML/CSS/JS site).",
    inputSchema: z.object({
      title: z.string().describe("The title of the artifact"),
      kind: z
        .enum(artifactKinds)
        .describe(
          "REQUIRED. 'code' for programming/algorithms, 'text' for essays/writing, 'sheet' for spreadsheets, 'site' for websites/landing pages"
        ),
    }),
    execute: async ({ title, kind }) => {
      const siteKeywords = [
        "site",
        "landing page",
        "page web",
        "website",
        "landingpage",
        "créer un site",
        "créer une page",
        "web page",
      ];
      const isSiteRequest = siteKeywords.some((kw) =>
        title.toLowerCase().includes(kw)
      );
      const finalKind = isSiteRequest ? "site" : kind;

      const id = generateUUID();

      dataStream.write({
        type: "data-kind",
        data: finalKind,
        transient: true,
      });

      dataStream.write({
        type: "data-id",
        data: id,
        transient: true,
      });

      dataStream.write({
        type: "data-title",
        data: title,
        transient: true,
      });

      dataStream.write({
        type: "data-clear",
        data: null,
        transient: true,
      });

      const documentHandler = documentHandlersByArtifactKind.find(
        (documentHandlerByArtifactKind) =>
          documentHandlerByArtifactKind.kind === finalKind
      );

      if (!documentHandler) {
        throw new Error(`No document handler found for kind: ${finalKind}`);
      }

      await documentHandler.onCreateDocument({
        id,
        title,
        dataStream,
        session,
        modelId,
        chatId,
      });

      dataStream.write({ type: "data-finish", data: null, transient: true });

      return {
        id,
        title,
        kind: finalKind,
        content:
          finalKind === "code"
            ? "A script was created and is now visible to the user."
            : finalKind === "site"
              ? "A website was created and is now visible to the user."
              : "A document was created and is now visible to the user.",
      };
    },
  });