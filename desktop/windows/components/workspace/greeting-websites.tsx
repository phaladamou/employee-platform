// components/workspace/greeting-websites.tsx
"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

export const GreetingWebsites = () => {
  const t = useTranslations("websites");

  return (
    <div className="flex flex-col items-center px-4" key="overview">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.35, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <h1 className="text-2xl text-black dark:text-white/90 md:text-3xl">
          {t("greeting")}
        </h1>
      </motion.div>
    </div>
  );
};
