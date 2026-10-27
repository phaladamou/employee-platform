// components/workspace/scientia-logo.tsx
import { cn } from "@/lib/utils";

interface ScientiaLogoProps {
  className?: string;
  size?: number;
}

export function ScientiaLogo({ size = 48, className }: ScientiaLogoProps) {
  return (
    <svg
      className={cn("flex-shrink-0", className)}
      fill="none"
      height={size}
      viewBox="0 0 200 200"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        className="fill-black dark:fill-white"
        d="M10 10 L190 10 L100 185 Z"
      />
      <path
        className="fill-white dark:fill-black"
        d="M40 30 L170 30 L103 155 Z"
      />
    </svg>
  );
}
