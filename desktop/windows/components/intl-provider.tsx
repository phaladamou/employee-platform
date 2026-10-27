"use client";

import { createContext, useContext, useState } from "react";

type IntlContextValue = {
  locale: string;
  timezone: string;
  setLocale: (v: string) => void;
  setTimezone: (v: string) => void;
  formatDate: (iso: string | null) => string;
  formatNumber: (n: number) => string;
};

const IntlContext = createContext<IntlContextValue | null>(null);

export function useIntl() {
  const ctx = useContext(IntlContext);
  if (!ctx) {
    throw new Error("useIntl must be used within IntlProvider");
  }
  return ctx;
}

function getDefaultLocale(): string {
  if (typeof navigator !== "undefined") {
    const nav = navigator.language;
    if (nav.startsWith("fr")) {
      return "fr";
    }
    if (nav.startsWith("en")) {
      return "en";
    }
  }
  return "fr";
}

function getDefaultTimezone(): string {
  if (typeof Intl !== "undefined") {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
  return "Europe/Paris";
}

export function IntlProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState(getDefaultLocale);
  const [timezone, setTimezone] = useState(getDefaultTimezone);

  function formatDate(iso: string | null) {
    if (!iso) {
      return "—";
    }
    return new Date(iso).toLocaleDateString(locale, {
      day: "numeric",
      month: "long",
      timeZone: timezone,
      year: "numeric",
    });
  }

  function formatNumber(n: number) {
    return new Intl.NumberFormat(locale).format(n);
  }

  return (
    <IntlContext.Provider
      value={{
        formatDate,
        formatNumber,
        locale,
        setLocale,
        setTimezone,
        timezone,
      }}
    >
      {children}
    </IntlContext.Provider>
  );
}
