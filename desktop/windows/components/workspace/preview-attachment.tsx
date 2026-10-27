// components/workspace/preview-attachment.tsx
import {
  FileCodeIcon,
  FileIcon,
  FileJsonIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
} from "lucide-react";
import Image from "next/image";
import type { Attachment } from "@/lib/types";
import { Spinner } from "../ui/spinner";
import { CrossSmallIcon } from "./icons";

function getFileStyle(contentType: string) {
  if (contentType === "application/pdf")
    return { icon: FileTextIcon, label: "PDF", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/40" };
  if (contentType.includes("word") || contentType.includes("document"))
    return { icon: FileTextIcon, label: "DOC", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/40" };
  if (contentType === "text/csv" || contentType.includes("spreadsheet"))
    return { icon: FileSpreadsheetIcon, label: "CSV", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/40" };
  if (contentType === "application/json")
    return { icon: FileJsonIcon, label: "JSON", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40" };
  if (contentType.includes("python"))
    return { icon: FileCodeIcon, label: "PY", color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-950/40" };
  if (contentType.includes("javascript"))
    return { icon: FileCodeIcon, label: "JS", color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-950/40" };
  if (contentType === "text/plain" || contentType === "text/markdown")
    return { icon: FileTextIcon, label: "TXT", color: "text-gray-600 dark:text-gray-400", bg: "bg-gray-50 dark:bg-gray-950/40" };
  return { icon: FileIcon, label: "FILE", color: "text-muted-foreground", bg: "bg-muted" };
}

export const PreviewAttachment = ({
  attachment,
  isUploading = false,
  onRemove,
}: {
  attachment: Attachment;
  isUploading?: boolean;
  onRemove?: () => void;
}) => {
  const { name, url, contentType } = attachment;
  const style = getFileStyle(contentType ?? "");
  const Icon = style.icon;
  const displayName = name
    ? name.length > 18
      ? `${name.slice(0, 15)}...${name.slice(-4)}`
      : name
    : "File";

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex shrink-0 items-center gap-2.5 rounded-xl border border-border/50 bg-card px-3.5 py-2.5 shadow-sm transition-all hover:border-border hover:shadow-md"
      data-testid="input-attachment-preview"
      onClick={(e) => e.stopPropagation()}
    >
      {contentType?.startsWith("image") ? (
        <Image
          alt={name ?? "attachment"}
          className="size-9 shrink-0 rounded-lg object-cover"
          height={36}
          src={url}
          width={36}
        />
      ) : (
        <div
          className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${style.bg}`}
        >
          <Icon className={`size-4 ${style.color}`} />
        </div>
      )}

      <div className="flex flex-col min-w-0">
        <span className="truncate text-[12px] font-medium text-foreground">
          {displayName}
        </span>
        <span className={`text-[10px] font-semibold tracking-wide ${style.color}`}>
          {style.label}
        </span>
      </div>

      {isUploading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/70 backdrop-blur-[2px]">
          <Spinner className="size-4" />
        </div>
      )}

      {onRemove && !isUploading && (
        <button
          className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground opacity-0 shadow-sm transition-all hover:bg-muted hover:text-foreground group-hover:opacity-100"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          type="button"
        >
          <CrossSmallIcon size={10} />
        </button>
      )}
    </a>
  );
};