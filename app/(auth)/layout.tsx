"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const dark = mounted && resolvedTheme === "dark";

  const toggleTheme = () => {
    setTheme(dark ? "light" : "dark");
  };

  if (!mounted) {
    return <div className="fixed inset-0 z-50 bg-background" />;
  }

  return (
    <main className="relative min-h-dvh w-full bg-background text-foreground">
      {/* IMAGE EN FOND */}
      <img
        alt=""
        aria-hidden="true"
        className="fixed inset-0 z-0 h-full w-full object-cover object-top"
        src="/images/employee-login.png"
      />

      {/* OVERLAY LÉGER */}
      <div className="fixed inset-0 z-[1] bg-black/10" />

      {/* THEME SWITCH */}
      <button
        type="button"
        onClick={toggleTheme}
        aria-label="Changer de thème"
        className="
          fixed right-6 top-6 z-30 flex items-center gap-3
          text-white/70 transition-colors
          hover:text-white
        "
      >
        <Sun className="size-[18px]" strokeWidth={1.6} />

        <span className="relative flex h-[26px] w-[48px] items-center rounded-full border border-white/20 bg-white/10 p-[3px] backdrop-blur-sm">
          <span
            className={`
              block h-[18px] w-[18px] rounded-full bg-white shadow-sm
              transition-transform duration-200
              ${dark ? "translate-x-[22px]" : "translate-x-0"}
            `}
          />
        </span>

        <Moon className="size-[17px]" strokeWidth={1.6} />
      </button>

      {/* CONTENU */}
      <div className="relative z-10 flex min-h-dvh w-full items-center justify-center px-6 py-12">
        <div
          className="
            w-full max-w-[460px]
            rounded-2xl
            border border-border/60
            bg-card/95
            p-8
            shadow-[0_8px_32px_rgba(0,0,0,0.25)]
            backdrop-blur-xl
          "
        >
          {children}
        </div>
      </div>

      {/* TAGLINE EN BAS À GAUCHE */}
      <div className="fixed bottom-8 left-8 z-20 hidden lg:block">
        <p className="max-w-[210px] text-[11px] font-medium leading-[1.8] tracking-[0.18em] text-white/55">
          AUTONOMOUS AI EMPLOYEES
          <br />
          FOR REAL WORK.
        </p>

        <div className="mt-5 h-px w-7 bg-white/80" />
      </div>
    </main>
  );
}
