// artifacts/site/client.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Artifact } from "@/components/workspace/create-artifact";
import { CopyIcon, RedoIcon, UndoIcon } from "@/components/workspace/icons";

type SiteData = {
  phase?: string;
  html: string;
  css: string;
  js: string;
};

function parseSiteContent(content: string): SiteData {
  try {
    return JSON.parse(content);
  } catch {
    return { html: "", css: "", js: "" };
  }
}

const phaseLabels: Record<string, string> = {
  html: "📝 Écriture du HTML",
  css: "🎨 Écriture du CSS",
  js: "⚡ Écriture du JavaScript",
};

function ProgressInline({ data }: { data: SiteData }) {
  const currentPhase = data.phase || "html";
  if (currentPhase === "done") return null;

  const phaseOrder = ["html", "css", "js"];
  const currentIndex = phaseOrder.indexOf(currentPhase);

  return (
    <div className="space-y-1.5 py-2">
      {phaseOrder.slice(0, currentIndex + 1).map((phase, i) => {
        const isCurrent = i === currentIndex;
        const label = phaseLabels[phase] || "";

        return (
          <div
            className={`flex items-center gap-2 text-sm ${
              isCurrent ? "text-foreground font-medium" : "text-green-500"
            }`}
            key={phase}
          >
            <span className="text-xs">
              {isCurrent ? (
                <span className="inline-block animate-pulse">●</span>
              ) : (
                "✓"
              )}
            </span>
            <span>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function SitePreview({ html, css, js }: SiteData) {
  const srcDoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@300;400;600&display=swap" rel="stylesheet">
  <style>body { margin: 0; background: #0a0a0a; } ${css}</style>
</head>
<body>${html}<script>${js}</script></body>
</html>`;

  return (
    <iframe
      className="w-full h-full border-0 bg-white"
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      title="Site preview"
    />
  );
}

export const siteArtifact = new Artifact<"site", {}>({
  kind: "site",
  description: "Génère un site web complet avec HTML, CSS et JavaScript",
  initialize: () => null,
  onStreamPart: ({ setArtifact, streamPart }) => {
    if (streamPart.type === "data-siteDelta") {
      setArtifact((draft) => ({
        ...draft,
        content: streamPart.data as string,
        isVisible: true,
        status: "streaming",
      }));
    }
  },
  content: ({ content, status, isInline }) => {
    const [tab, setTab] = useState<"preview" | "html" | "css" | "js">(
      "preview"
    );
    const data = parseSiteContent(content || "{}");
    const isDone = data.phase === "done";

    // Dans la conversation : progression textuelle
    if (isInline) {
      if (isDone) return null;
      return <ProgressInline data={data} />;
    }

    // Dans le panneau droit : toujours le site
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-1 px-4 py-2 border-b border-border bg-muted/30">
          <TabButton
            active={tab === "preview"}
            onClick={() => setTab("preview")}
          >
            Aperçu
          </TabButton>
          <TabButton active={tab === "html"} onClick={() => setTab("html")}>
            HTML
          </TabButton>
          <TabButton active={tab === "css"} onClick={() => setTab("css")}>
            CSS
          </TabButton>
          <TabButton active={tab === "js"} onClick={() => setTab("js")}>
            JS
          </TabButton>
        </div>
        <div className="flex-1 overflow-hidden">
          {tab === "preview" ? (
            <SitePreview css={data.css} html={data.html} js={data.js} />
          ) : (
            <pre className="h-full overflow-auto p-4 text-xs font-mono bg-muted/20 text-foreground whitespace-pre-wrap">
              {data[tab] || ""}
            </pre>
          )}
        </div>
      </div>
    );
  },
  actions: [
    {
      icon: <UndoIcon size={18} />,
      description: "Version précédente",
      onClick: ({ handleVersionChange }) => handleVersionChange("prev"),
      isDisabled: ({ currentVersionIndex }) => currentVersionIndex === 0,
    },
    {
      icon: <RedoIcon size={18} />,
      description: "Version suivante",
      onClick: ({ handleVersionChange }) => handleVersionChange("next"),
      isDisabled: ({ isCurrentVersion }) => isCurrentVersion,
    },
    {
      icon: <CopyIcon size={18} />,
      description: "Copier le code HTML",
      onClick: ({ content }) => {
        const data = parseSiteContent(content);
        navigator.clipboard.writeText(data.html);
        toast.success("HTML copié !");
      },
    },
  ],
  toolbar: [],
});
