// components/workspace/document-preview.tsx
"use client";

import equal from "fast-deep-equal";
import {
  type MouseEvent,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import useSWR from "swr";
import { useArtifact } from "@/hooks/use-artifact";
import type { Document } from "@/lib/db/schema";
import { cn, fetcher } from "@/lib/utils";
import type { ArtifactKind, UIArtifact } from "./artifact";
import { CodeEditor } from "./code-editor";
import { InlineDocumentSkeleton } from "./document-skeleton";
import {
  CodeIcon,
  FileIcon,
  FullscreenIcon,
  ImageIcon,
  LoaderIcon,
} from "./icons";
import { ImageEditor } from "./image-editor";
import { SpreadsheetEditor } from "./sheet-editor";
import { Editor } from "./text-editor";

type DocumentToolOutput = {
  id: string;
  title: string;
  kind: ArtifactKind;
  content?: string;
};

type DocumentPreviewProps = {
  isReadonly: boolean;
  result?: Partial<DocumentToolOutput>;
  args?: Partial<DocumentToolOutput> & { isUpdate?: boolean };
};

type ExtendedDocument = {
  id: string;
  createdAt: Date;
  title: string;
  userId: string;
  content: string | null;
  kind: string;
};

function SiteProgressInline({ content }: { content: string }) {
  let data: { phase?: string; html?: string; css?: string; js?: string } = {};
  try {
    data = JSON.parse(content);
  } catch {
    // noop
  }

  const phaseLabels: Record<string, string> = {
    html: "📝 Écriture du HTML",
    css: "🎨 Écriture du CSS",
    js: "⚡ Écriture du JavaScript",
    done: "✅ Site terminé",
  };
  const phaseOrder = ["html", "css", "js", "done"];
  const currentPhase = data.phase || "html";

  return (
    <div className="space-y-1.5 p-4">
      {phaseOrder.map((phase) => {
        const phaseIndex = phaseOrder.indexOf(phase);
        const currentIndex = phaseOrder.indexOf(currentPhase);
        const done = phaseIndex < currentIndex;
        const active = phase === currentPhase;

        return (
          <div
            className={`flex items-center gap-2 text-sm ${
              done
                ? "text-green-500"
                : active
                  ? "text-foreground font-medium"
                  : "text-muted-foreground/50"
            }`}
            key={phase}
          >
            <span className="w-4 text-center text-xs">
              {done ? "✓" : active ? "●" : "○"}
            </span>
            <span>{phaseLabels[phase]}</span>
            {active && !done && phase !== "done" && (
              <span className="text-xs text-muted-foreground animate-pulse ml-auto">
                {phase === "html" && data.html
                  ? `${data.html.length} car.`
                  : ""}
                {phase === "css" && data.css ? `${data.css.length} car.` : ""}
                {phase === "js" && data.js ? `${data.js.length} car.` : ""}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function DocumentPreview({
  isReadonly: _isReadonly,
  result,
  args,
}: DocumentPreviewProps) {
  const { artifact, setArtifact } = useArtifact();

  const { data: documents, isLoading: isDocumentsFetching } = useSWR<
    Document[]
  >(
    result
      ? `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/document?id=${result.id}`
      : null,
    fetcher
  );

  const previewDocument = useMemo(() => documents?.[0], [documents]);
  const hitboxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const boundingBox = hitboxRef.current?.getBoundingClientRect();

    if (artifact.documentId && boundingBox) {
      setArtifact((currentArtifact) => ({
        ...currentArtifact,
        boundingBox: {
          left: boundingBox.x,
          top: boundingBox.y,
          width: boundingBox.width,
          height: boundingBox.height,
        },
      }));
    }
  }, [artifact.documentId, setArtifact]);

  if (isDocumentsFetching) {
    const kind = result?.kind ?? args?.kind ?? artifact.kind;
    const title = result?.title ?? args?.title ?? artifact.title;

    return (
      <div className="w-full max-w-[450px]">
        {title ? (
          <DocumentHeader isStreaming={true} kind={kind} title={title} />
        ) : (
          <div className="flex flex-row items-center justify-between gap-2 rounded-t-2xl border border-b-0 border-border/50 px-4 py-3 dark:bg-muted">
            <div className="flex flex-row items-center gap-2.5">
              <div className="size-3.5 animate-pulse rounded bg-muted-foreground/15" />
              <div className="h-3.5 w-24 animate-pulse rounded bg-muted-foreground/15" />
            </div>
            <div className="w-8" />
          </div>
        )}
        <div className="h-[257px] overflow-hidden rounded-b-2xl border border-t-0 border-border/50 bg-muted p-6">
          <InlineDocumentSkeleton />
        </div>
      </div>
    );
  }

  const document: ExtendedDocument | null = previewDocument
    ? {
        id: previewDocument.id,
        createdAt: previewDocument.createdAt,
        title: previewDocument.title,
        userId: previewDocument.userId,
        content: previewDocument.content,
        kind: previewDocument.kind,
      }
    : artifact.status === "streaming"
      ? {
          title: artifact.title,
          kind: artifact.kind,
          content: artifact.content,
          id: artifact.documentId,
          createdAt: new Date(),
          userId: "noop",
        }
      : null;

  if (!document) {
    return <LoadingSkeleton artifactKind={artifact.kind} />;
  }

  return (
    <div className="relative w-full max-w-[450px] cursor-pointer">
      <HitboxLayer
        hitboxRef={hitboxRef}
        result={result}
        setArtifact={setArtifact}
      />
      <DocumentHeader
        isStreaming={artifact.status === "streaming"}
        kind={document.kind as ArtifactKind}
        title={document.title}
      />
      <DocumentContent document={document as Document} />
    </div>
  );
}

const LoadingSkeleton = ({ artifactKind }: { artifactKind: ArtifactKind }) => (
  <div className="w-full max-w-[450px]">
    <div className="flex flex-row items-center justify-between gap-2 rounded-t-2xl border border-b-0 border-border/50 px-4 py-3 dark:bg-muted">
      <div className="flex flex-row items-center gap-2.5">
        <div className="size-3.5 animate-pulse rounded bg-muted-foreground/15" />
        <div className="h-3.5 w-24 animate-pulse rounded bg-muted-foreground/15" />
      </div>
      <div className="w-8" />
    </div>
    {artifactKind === "image" ? (
      <div className="overflow-hidden rounded-b-2xl border border-t-0 border-border/50 bg-muted">
        <div className="h-[257px] w-full animate-pulse bg-muted-foreground/10" />
      </div>
    ) : (
      <div className="h-[257px] overflow-hidden rounded-b-2xl border border-t-0 border-border/50 bg-muted p-6">
        <InlineDocumentSkeleton />
      </div>
    )}
  </div>
);

const PureHitboxLayer = ({
  hitboxRef,
  result,
  setArtifact,
}: {
  hitboxRef: React.RefObject<HTMLDivElement | null>;
  result?: Partial<DocumentToolOutput>;
  setArtifact: (
    updaterFn: UIArtifact | ((currentArtifact: UIArtifact) => UIArtifact)
  ) => void;
}) => {
  const handleClick = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      const boundingBox = event.currentTarget.getBoundingClientRect();

      setArtifact((artifact) => ({
        ...artifact,
        ...(result?.id && { documentId: result.id }),
        ...(result?.title && { title: result.title }),
        ...(result?.kind && { kind: result.kind }),
        isVisible: true,
        boundingBox: {
          left: boundingBox.x,
          top: boundingBox.y,
          width: boundingBox.width,
          height: boundingBox.height,
        },
      }));
    },
    [setArtifact, result]
  );

  return (
    <div
      aria-hidden="true"
      className="absolute top-0 left-0 z-10 size-full rounded-xl"
      onClick={handleClick}
      ref={hitboxRef}
      role="presentation"
    >
      <div className="flex w-full items-center justify-end p-4">
        <div className="absolute top-[13px] right-[9px] rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <FullscreenIcon />
        </div>
      </div>
    </div>
  );
};

const HitboxLayer = memo(PureHitboxLayer, (prevProps, nextProps) => {
  if (!equal(prevProps.result, nextProps.result)) {
    return false;
  }
  return true;
});

const PureDocumentHeader = ({
  title,
  kind,
  isStreaming,
}: {
  title: string;
  kind: ArtifactKind;
  isStreaming: boolean;
}) => (
  <div className="flex flex-row items-center justify-between gap-2 rounded-t-2xl border border-b-0 border-border/50 px-4 py-3 dark:bg-muted">
    <div className="flex flex-row items-center gap-2.5">
      <div className="text-muted-foreground">
        {isStreaming ? (
          <div className="animate-spin">
            <LoaderIcon size={14} />
          </div>
        ) : kind === "image" ? (
          <ImageIcon size={14} />
        ) : kind === "code" ? (
          <CodeIcon size={14} />
        ) : kind === "site" ? (
          <CodeIcon size={14} />
        ) : (
          <FileIcon size={14} />
        )}
      </div>
      <div className="text-sm font-medium">{title}</div>
    </div>
    <div className="w-8" />
  </div>
);

const DocumentHeader = memo(PureDocumentHeader, (prevProps, nextProps) => {
  if (prevProps.title !== nextProps.title) {
    return false;
  }
  if (prevProps.isStreaming !== nextProps.isStreaming) {
    return false;
  }

  return true;
});

const DocumentContent = ({ document }: { document: Document }) => {
  const { artifact } = useArtifact();

  const containerClassName = cn(
    "h-[257px] overflow-hidden rounded-b-2xl border border-t-0 border-border/50 dark:bg-muted",
    {
      "p-4 sm:px-10 sm:py-10": document.kind === "text",
      "p-0": document.kind === "code",
    }
  );

  const commonProps = {
    content: document.content ?? "",
    isCurrentVersion: true,
    currentVersionIndex: 0,
    status: artifact.status,
    saveContent: (_content: string, _debounce: boolean) => {},
    suggestions: [] as any[],
  };

  const handleSaveContent = (_content: string) => {};

  return (
    <div className={cn(containerClassName, "relative")}>
      {document.kind === "text" ? (
        <Editor {...commonProps} onSaveContent={handleSaveContent} />
      ) : document.kind === "code" ? (
        <div className="relative flex w-full flex-1">
          <div className="absolute inset-0">
            <CodeEditor {...commonProps} onSaveContent={handleSaveContent} />
          </div>
        </div>
      ) : document.kind === "sheet" ? (
        <div className="relative flex size-full flex-1 p-4">
          <div className="absolute inset-0">
            <SpreadsheetEditor {...commonProps} />
          </div>
        </div>
      ) : document.kind === "image" ? (
        <ImageEditor
          content={document.content ?? ""}
          currentVersionIndex={0}
          isCurrentVersion={true}
          isInline={true}
          status={artifact.status}
          title={document.title}
        />
      ) : document.kind === "site" ? (
        <SiteProgressInline content={document.content ?? ""} />
      ) : null}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-muted to-transparent dark:from-muted" />
      {document.kind === "code" && (
        <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-muted to-transparent dark:from-muted" />
      )}
    </div>
  );
};
