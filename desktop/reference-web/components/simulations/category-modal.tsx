// components/simulations/category-modal.tsx
"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CATEGORIES } from "@/lib/simulations/constants";

type CategoryModalProps = {
  isOpen: boolean;
  onSelect: (category: string) => void;
};

export function CategoryModal({ isOpen, onSelect }: CategoryModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
        >
          <motion.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-lg rounded-2xl border border-border/50 bg-card p-6 shadow-[var(--shadow-float)]"
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="text-center mb-6">
              <h2 className="text-lg font-semibold text-foreground tracking-tight">
                Choose your field
              </h2>
              <p className="text-[13px] text-muted-foreground mt-1">
                Select a scientific domain to get started
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {CATEGORIES.map((cat, index) => (
                <motion.button
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center gap-2 rounded-xl border border-border/50 bg-card/30 px-4 py-5 text-center transition-all hover:border-border/60 hover:bg-card/50 hover:shadow-sm"
                  initial={{ opacity: 0, y: 8 }}
                  key={cat.id}
                  onClick={() => onSelect(cat.id)}
                  transition={{ delay: 0.04 * index, duration: 0.25 }}
                  type="button"
                >
                  <span className="text-2xl">{cat.icon}</span>
                  <span className="text-[13px] font-medium text-foreground">
                    {cat.label}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {cat.description}
                  </span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
