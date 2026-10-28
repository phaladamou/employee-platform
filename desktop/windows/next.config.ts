// next.config.ts
import path from "node:path";
import { withBotId } from "botid/next/config";
import type { NextConfig } from "next";
import type { Redirect } from "next/dist/lib/load-custom-routes";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n.ts");

const basePath = process.env.IS_DEMO === "1" ? "/demo" : "";
const isDesktopBuild = process.env.DESKTOP_BUILD === "1";

const nextConfig: NextConfig = {
  // Application bureau : serveur autonome embarque dans Electron.
  output: isDesktopBuild ? "standalone" : undefined,
  // Build bureau : la verification des types et le lint sont assures par
  // `pnpm desktop:typecheck` (porte separee). Les desactiver ici evite aussi
  // de cumuler webpack + tsc dans un seul processus (pression memoire).
  ...(isDesktopBuild
    ? {
        typescript: { ignoreBuildErrors: true },
        eslint: { ignoreDuringBuilds: true },
      }
    : {}),
  // Chantier isole dans desktop/ : le tracing de fichiers ne doit pas
  // remonter a la racine du depot (mauvais lockfile selectionne sinon).
  outputFileTracingRoot: path.join(__dirname),
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
    // Bureau : pas d'optimiseur distant, images servies telles quelles.
    // (Evite aussi le binaire natif sharp, non portable vers Windows.)
    unoptimized: isDesktopBuild,
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
    // Build bureau : un seul CPU pour limiter l'empreinte memoire
    // (workers SWC/generation) sur les machines chargees.
    ...(isDesktopBuild ? { cpus: 1 } : {}),
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
