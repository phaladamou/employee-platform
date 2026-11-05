// components/workspace/greeting.tsx
"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useUser } from "@/hooks/use-user";

export const Greeting = () => {
  const t = useTranslations("chat");
  const { user } = useUser();

  const firstName = user?.name?.trim().split(/\s+/)[0] ?? "";
  const lines = [
    firstName ? t("chefHelloNamed", { name: firstName }) : t("chefHello"),
    t("chefIntro1"),
    t("chefIntro2"),
    t("chefIntro3"),
    t("chefIntro4"),
  ];

  return (
    <div className="w-full px-4" key="overview">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2.5 text-left"
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.35, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        {lines.map((line, index) => (
          <p
            className={
              index === 0
                ? "text-base font-semibold leading-snug text-foreground"
                : "text-[15px] leading-relaxed text-muted-foreground"
            }
            key={index}
          >
            {line}
          </p>
        ))}
      </motion.div>
    </div>
  );
};
