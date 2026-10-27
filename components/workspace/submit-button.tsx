"use client";

import { MoveRight } from "lucide-react";
import { useFormStatus } from "react-dom";

import { LoaderIcon } from "@/components/workspace/icons";
import { Button } from "../ui/button";

export function SubmitButton({
  children,
  isSuccessful,
}: {
  children: React.ReactNode;
  isSuccessful: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      aria-disabled={pending || isSuccessful}
      className="
        relative mt-1.5 h-11 w-full cursor-pointer
        rounded-lg bg-foreground text-[13px] font-medium text-background
        shadow-none transition-colors duration-150
        hover:bg-foreground/90
        disabled:cursor-not-allowed disabled:opacity-80
      "
      disabled={pending || isSuccessful}
      type={pending ? "button" : "submit"}
    >
      <span className="flex items-center gap-2">
        {children}
        <MoveRight className="size-4" strokeWidth={1.8} />
      </span>

      {(pending || isSuccessful) && (
        <span className="absolute right-4 animate-spin">
          <LoaderIcon />
        </span>
      )}

      <output aria-live="polite" className="sr-only">
        {pending || isSuccessful ? "Loading" : "Submit form"}
      </output>
    </Button>
  );
}
