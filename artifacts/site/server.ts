// artifacts/site/server.ts
import { streamText } from "ai";
import { getLanguageModel } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";

const CLASSES =
  "navbar,nav-links,logo,hamburger,hero,hero-title,hero-subtitle,badge,btn,btn-primary,features,card,card-icon,card-title,card-text,product,product-card,product-img,product-info,product-title,product-price,testimonials,testimonial-card,testimonial-text,testimonial-author,cta-final,footer,reveal,glass";

function buildFullSite(html: string, css: string, js: string): string {
  return JSON.stringify({ html, css, js });
}

export const siteDocumentHandler = createDocumentHandler<"site">({
  kind: "site",
  onCreateDocument: async ({ title, dataStream, modelId }) => {
    const model = getLanguageModel(modelId);
    let html = "";
    let css = "";
    let js = "";

    // HTML
    const htmlResult = streamText({
      model,
      system: `Écris UNIQUEMENT du HTML entre <body> et </body>. ${title}. Sections : nav.navbar, section.hero, section.features (3 div.card), section.product (div.product-card), section.testimonials (2 div.testimonial-card), section.cta-final, footer. Classes : ${CLASSES}. PAS CSS, PAS JS, PAS markdown. HTML PUR.`,
      messages: [{ role: "user", content: "Génère le HTML" }],
      temperature: 0.3,
      maxOutputTokens: 4096,
    });

    for await (const chunk of htmlResult.fullStream) {
      if (chunk.type === "text-delta") {
        html += chunk.text;
        dataStream.write({
          type: "data-siteDelta",
          data: buildFullSite(html, css, js),
          transient: true,
        });
      }
    }

    // CSS
    const cssResult = streamText({
      model,
      system: `Écris UNIQUEMENT du CSS. Design luxe : fond #0a0a0a, doré #d4af37, glassmorphisme, animations. Classes : ${CLASSES}. PAS HTML, PAS JS, PAS markdown. CSS PUR.`,
      messages: [{ role: "user", content: "Génère le CSS" }],
      temperature: 0.3,
      maxOutputTokens: 4096,
    });

    for await (const chunk of cssResult.fullStream) {
      if (chunk.type === "text-delta") {
        css += chunk.text;
        dataStream.write({
          type: "data-siteDelta",
          data: buildFullSite(html, css, js),
          transient: true,
        });
      }
    }

    // JS
    const jsResult = streamText({
      model,
      system: `Écris UNIQUEMENT du JS vanilla. Scroll reveal, navbar scroll, menu hamburger, smooth scroll. Classes : ${CLASSES}. PAS HTML, PAS CSS, PAS markdown. JS PUR.`,
      messages: [{ role: "user", content: "Génère le JS" }],
      temperature: 0.2,
      maxOutputTokens: 2048,
    });

    for await (const chunk of jsResult.fullStream) {
      if (chunk.type === "text-delta") {
        js += chunk.text;
        dataStream.write({
          type: "data-siteDelta",
          data: buildFullSite(html, css, js),
          transient: true,
        });
      }
    }

    return buildFullSite(html, css, js);
  },
  onUpdateDocument: async ({ document, description, dataStream, modelId }) => {
    const model = getLanguageModel(modelId);
    let updated = "";

    const result = streamText({
      model,
      system:
        "Modifie le site existant selon la demande. Réponds avec le JSON complet { html, css, js }",
      messages: [
        {
          role: "user",
          content: `Site actuel: ${document.content}\nDemande: ${description}`,
        },
      ],
      temperature: 0.2,
      maxOutputTokens: 4096,
    });

    for await (const chunk of result.fullStream) {
      if (chunk.type === "text-delta") {
        updated += chunk.text;
        dataStream.write({
          type: "data-siteDelta",
          data: updated,
          transient: true,
        });
      }
    }

    return updated || document.content || "";
  },
});
