// components/workspace/capabilities-carousel.tsx
"use client";

import { AnimatePresence, motion } from "framer-motion";
import { XIcon } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

const cards = [
  {
    image: "/images/capabilities/microscope.svg",
    titleKey: "laboratory",
    descriptionKey: "laboratoryDescription",
  },
  {
    image: "/images/capabilities/code.svg",
    titleKey: "development",
    descriptionKey: "developmentDescription",
  },
  {
    image: "/images/capabilities/book.svg",
    titleKey: "learning",
    descriptionKey: "learningDescription",
  },
];

export function CapabilitiesCarousel({ onDismiss }: { onDismiss: () => void }) {
  const t = useTranslations("chat");
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % cards.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full max-w-sm mx-auto relative">
      <div className="relative overflow-hidden rounded-xl border border-border/30 bg-card/20">
        <button
          aria-label="Close"
          className="absolute top-1.5 right-1.5 z-10 size-5 rounded-full flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/50 transition-colors"
          onClick={onDismiss}
          type="button"
        >
          <XIcon size={12} />
        </button>

        <AnimatePresence mode="wait">
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-3"
            exit={{ opacity: 0, y: -8 }}
            initial={{ opacity: 0, y: 8 }}
            key={`card-${current}`}
            transition={{ duration: 0.35, ease: "easeInOut" }}
          >
            <div className="size-10 rounded-lg overflow-hidden shrink-0 border border-border/20 bg-white">
              <Image
                alt={t(cards[current].titleKey)}
                className="object-contain size-full p-1.5"
                height={40}
                src={cards[current].image}
                unoptimized
                width={40}
              />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-semibold text-foreground tracking-tight">
                {t(cards[current].titleKey)}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                {t(cards[current].descriptionKey)}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
        <div className="flex justify-center gap-1 pb-2">
          {cards.map((_, i) => (
            <button
              aria-label={`Slide ${i + 1}`}
              className={`size-1 rounded-full transition-all duration-300 ${
                i === current
                  ? "bg-foreground w-3"
                  : "bg-muted-foreground/20 hover:bg-muted-foreground/40"
              }`}
              key={i}
              onClick={() => setCurrent(i)}
              type="button"
            />
          ))}
        </div>
      </div>
    </div>
  );
}