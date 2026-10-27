// components/workspace/scientia-logo.tsx
import { cn } from "@/lib/utils";

interface EmployeeLogoProps {
  className?: string;
  size?: number;
}

export function EmployeeLogo({ size = 24, className }: EmployeeLogoProps) {
  return (
    <svg
      className={cn("flex-shrink-0", className)}
      fill="none"
      height={size}
      viewBox="0 0 200 200"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect fill="#ffffff" height="200" width="200" />
      <polygon fill="#000000" points="37,42 163,42 100,165 37,42" />
      <polygon fill="#ffffff" points="59,54 150,54 104,142 59,54" />
    </svg>
  );
}
