// hooks/use-user.ts
"use client";

import useSWR from "swr";

export function useUser() {
  const { data, error, isLoading, mutate } = useSWR(
    "/api/user",
    async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch user");
      const data = await res.json();
      return data.user;
    },
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 2000,
    }
  );

  return {
    user: data,
    isLoading,
    isError: error,
    mutate,
  };
}