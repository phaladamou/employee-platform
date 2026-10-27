// components/computer/connector-logo.tsx
"use client";

import * as simpleIcons from "simple-icons";

export function ConnectorLogo({
  icon,
  color,
  name = "?",
  className = "size-5",
}: {
  icon: string;
  color: string;
  name?: string;
  className?: string;
}) {
  const key = `si${icon.charAt(0).toUpperCase()}${icon.slice(1)}`;
  const simpleIcon = (simpleIcons as Record<string, unknown>)[key] as
    | { path: string }
    | undefined;

  if (!simpleIcon || typeof simpleIcon.path !== "string") {
    return (
      <div
        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[12px] font-medium text-white/95"
        style={{ backgroundColor: color }}
      >
        {name.charAt(0)}
      </div>
    );
  }

  return (
    <div
      className="flex size-8 shrink-0 items-center justify-center rounded-lg"
      style={{ backgroundColor: color }}
    >
      <svg
        aria-hidden="true"
        className={className}
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d={simpleIcon.path} fill="white" />
      </svg>
    </div>
  );
}
