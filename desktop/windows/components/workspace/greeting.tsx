// components/workspace/greeting.tsx
"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

function getGreeting(t: ReturnType<typeof useTranslations>): string {
  const hour = new Date().getHours();
  let timeKey: string;
  if (hour >= 5 && hour < 12) timeKey = "morning";
  else if (hour >= 12 && hour < 17) timeKey = "afternoon";
  else if (hour >= 17 && hour < 22) timeKey = "evening";
  else timeKey = "night";

  // 1 chance sur 2 d'avoir un message basé sur l'heure
  if (Math.random() > 0.5) {
    const pool = [
      t(`${timeKey}1`),
      t(`${timeKey}2`),
      t(`${timeKey}3`),
    ];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  const greetings = [
    t("greeting1"), t("greeting2"), t("greeting3"), t("greeting4"), t("greeting5"),
    t("greeting6"), t("greeting7"), t("greeting8"), t("greeting9"), t("greeting10"),
  ];
  return greetings[Math.floor(Math.random() * greetings.length)];
}

export const Greeting = () => {
  const t = useTranslations("chat");
  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    setGreeting(getGreeting(t));
  }, [t]);

  return (
    <div className="flex flex-col items-center px-4" key="overview">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-5 text-center"
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.35, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="text-2xl text-black dark:text-white/90 md:text-3xl">
          {greeting}
        </p>
      </motion.div>
    </div>
  );
};