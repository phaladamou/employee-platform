// i18n.ts

import { headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async () => {
  let locale = "en";

  try {
    const headersList = await headers();
    const cookieHeader = headersList.get("cookie") ?? "";

    const match = cookieHeader.match(/NEXT_LOCALE=([^;]+)/);

    if (match && ["en", "fr", "zh"].includes(match[1])) {
      locale = match[1];
    }
  } catch {
    locale = "en";
  }

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});