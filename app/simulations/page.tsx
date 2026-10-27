// app/simulations/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CategoryModal } from "@/components/simulations/category-modal";

export default function SimulationsPage() {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkCategory() {
      try {
        const res = await fetch("/api/simulations/category");
        if (res.ok) {
          const data = await res.json();
          if (data.category) {
            router.replace(`/simulations/${data.category}`);
            return;
          }
        }
      } catch {
        // Ignore error, show modal
      }
      setShowModal(true);
      setLoading(false);
    }
    checkCategory();
  }, [router]);

  async function handleSelect(category: string) {
    await fetch("/api/simulations/category", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category }),
    });
    router.push(`/simulations/${category}`);
  }

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <div className="size-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
      </div>
    );
  }

  return <CategoryModal isOpen={showModal} onSelect={handleSelect} />;
}
