"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/utils";

export function useLinkSafety() {
  const { data } = useSWR<{ preferences: Record<string, unknown> }>(
    "/api/settings",
    fetcher,
    { revalidateOnFocus: false }
  );
  const disabled = (data?.preferences?.linkSafetyDisabled as boolean) ?? false;
  return !disabled;
}
