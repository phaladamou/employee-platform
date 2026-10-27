// next.config.ts
import { withBotId } from "botid/next/config";
import type { NextConfig } from "next";
import type { Redirect } from "next/dist/lib/load-custom-routes";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n.ts");

const basePath = process.env.IS_DEMO === "1" ? "/demo" : "";

const nextConfig: NextConfig = {
  ...(basePath
    ? {
        basePath,
        assetPrefix: "/demo-assets",
      }
    : {}),
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  redirects: async () => {
    const rules: Redirect[] = [
      {
        source: "/legal",
        destination: "/terms",
        permanent: false,
      },
    ];

    if (basePath) {
      rules.push({
        source: "/",
        destination: basePath,
        permanent: false,
        basePath: false,
      });
    }

    return rules;
  },
  devIndicators: false,
  poweredByHeader: false,
  logging: {
    fetches: {
      fullUrl: false,
    },
    incomingRequests: false,
  },
  images: {
    remotePatterns: [
      { hostname: "avatar.vercel.sh" },
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "media.licdn.com",
      },
      {
        protocol: "https",
        hostname: "pbs.twimg.com",
      },
    ],
  },
  experimental: {
    inlineCss: true,

    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "localhost:3001",
        "127.0.0.1:3000",
        "127.0.0.1:3001",
        "*.app.github.dev",
      ],
    },
  },
};

export default withBotId(withNextIntl(nextConfig));
