// components/workspace/inspiration-gallery.tsx
"use client";

import { motion } from "framer-motion";
import { CheckIcon, EyeIcon, XIcon } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

const templates = [
  {
    src: "/images/templates/tem1.png",
    label: "Curie Lab",
    desc: "Site vitrine pour laboratoire",
  },
  {
    src: "/images/templates/tem2.png",
    label: "Einstein Portfolio",
    desc: "CV académique chercheur",
  },
  {
    src: "/images/templates/tem3.png",
    label: "Symposium",
    desc: "Page de conférence",
  },
  {
    src: "/images/templates/tem4.png",
    label: "BioDocs",
    desc: "Documentation & protocoles",
  },
  {
    src: "/images/templates/tem5.png",
    label: "Kepler Dashboard",
    desc: "Visualisation de données",
  },
  {
    src: "/images/templates/tem6.png",
    label: "Mendel Genomix",
    desc: "Analyse séquentielle",
  },
  {
    src: "/images/templates/tem7.png",
    label: "Turing Notebook",
    desc: "Code interactif Jupyter",
  },
  {
    src: "/images/templates/tem8.png",
    label: "Newton Calcul",
    desc: "Équations LaTeX avancées",
  },
];

export function InspirationGallery({
  onSelect,
  selectedTemplate,
}: {
  onSelect: (template: { src: string; label: string } | null) => void;
  selectedTemplate: { src: string; label: string } | null;
}) {
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  return (
    <>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3 mt-4 px-2 w-full max-w-3xl mx-auto"
        initial={{ opacity: 0, y: 8 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        <motion.p
          animate={{ opacity: 1 }}
          className="text-left text-[11px] uppercase tracking-wider font-semibold text-black/80 dark:text-white/80"
          initial={{ opacity: 0 }}
          transition={{ delay: 0.35, duration: 0.3 }}
        >
          Select Templates
        </motion.p>
        <div className="grid grid-cols-4 gap-2">
          {templates.map((template, index) => {
            const isSelected = selectedTemplate?.src === template.src;

            return (
              <motion.button
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center gap-1 group cursor-pointer"
                initial={{ opacity: 0, y: 8 }}
                key={template.label}
                transition={{ delay: 0.3 + index * 0.04, duration: 0.35 }}
                type="button"
              >
                <div
                  className={`relative w-full overflow-hidden rounded-xl border bg-muted/50 transition-all duration-300 group-hover:shadow-lg group-hover:shadow-black/5 dark:group-hover:shadow-white/5 ${
                    isSelected
                      ? "border-blue-500 dark:border-blue-400 ring-2 ring-blue-500/30 dark:ring-blue-400/30"
                      : "border-black/30 dark:border-white/25 group-hover:border-black/40 dark:group-hover:border-white/35"
                  }`}
                  onClick={() => {
                    console.log("CLICKED", template.label);
                    onSelect(
                      isSelected
                        ? null
                        : { src: template.src, label: template.label }
                    );
                  }}
                  style={{ aspectRatio: "16 / 9" }}
                >
                  <Image
                    alt={template.label}
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    fill
                    sizes="(max-width: 768px) 25vw, 12vw"
                    src={template.src}
                    unoptimized
                  />
                  {isSelected && (
                    <div className="absolute top-2 left-2 rounded-full bg-blue-500 p-0.5">
                      <CheckIcon
                        className="size-3.5 text-white"
                        strokeWidth={3}
                      />
                    </div>
                  )}
                  <div
                    className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewSrc(template.src);
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="flex items-center gap-1 rounded-md bg-black/60 backdrop-blur-sm px-2 py-1 text-[10px] text-white hover:bg-black/80 transition-colors">
                      <EyeIcon className="size-3" />
                      <span>Preview</span>
                    </div>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-medium leading-tight text-center ${
                    isSelected
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-black/70 dark:text-white/60"
                  }`}
                >
                  {template.label}
                </span>
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {previewSrc && (
        <motion.div
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          onClick={() => setPreviewSrc(null)}
          transition={{ duration: 0.2 }}
        >
          <button
            className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
            onClick={() => setPreviewSrc(null)}
            type="button"
          >
            <XIcon className="size-5" />
          </button>
          <motion.div
            animate={{ scale: 1, opacity: 1 }}
            className="relative w-full max-w-4xl rounded-xl overflow-hidden border border-white/20 shadow-2xl"
            initial={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            transition={{ duration: 0.2 }}
          >
            <Image
              alt="Preview"
              className="object-contain w-full h-auto"
              height={800}
              src={previewSrc}
              unoptimized
              width={1200}
            />
          </motion.div>
        </motion.div>
      )}
    </>
  );
}
