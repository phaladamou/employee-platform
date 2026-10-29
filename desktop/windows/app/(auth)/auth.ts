// app/(auth)/auth.ts
import { compare } from "bcrypt-ts";
import { eq } from "drizzle-orm";
import NextAuth, { type DefaultSession } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import LinkedIn from "next-auth/providers/linkedin";
import Twitter from "next-auth/providers/twitter";
import { DUMMY_PASSWORD } from "@/lib/constants";
import { getDb, isDesktop } from "@/lib/db/client";
import { getUser } from "@/lib/db/queries";
import { user as userTable } from "@/lib/db/schema";
import { authConfig } from "./auth.config";

// Plus de mode invite : tout acces exige un compte.
export type UserType = "regular";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      type: UserType;
    } & DefaultSession["user"];
  }

  interface User {
    id?: string;
    email?: string | null;
    type: UserType;
    isLink?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    type: UserType;
    image?: string | null;
    name?: string | null;
    email?: string | null;
    isLink?: boolean;
    linkedProvider?: string;
    linkedProfileId?: string;
    linkedProfileName?: string;
  }
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  providers: [
    // Bureau : pas d'OAuth cloud (credentials uniquement).
    ...(isDesktop()
      ? []
      : [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      profile(profile) {
        return {
          id: profile.sub,
          email: profile.email,
          name: profile.name,
          image: profile.picture,
          type: "regular" as const,
        };
      },
    }),
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
      profile(profile) {
        return {
          id: profile.id?.toString(),
          email: profile.email,
          name: profile.login,
          image: profile.avatar_url,
          type: "regular" as const,
        };
      },
    }),
    LinkedIn({
      clientId: process.env.AUTH_LINKEDIN_ID,
      clientSecret: process.env.AUTH_LINKEDIN_SECRET,
      profile(profile) {
        return {
          id: profile.sub,
          email: profile.email,
          name: profile.name,
          image: profile.picture,
          type: "regular" as const,
        };
      },
    }),
    Twitter({
      clientId: process.env.AUTH_TWITTER_ID,
      clientSecret: process.env.AUTH_TWITTER_SECRET,
      profile(profile) {
        return {
          id: profile.data?.id,
          email: profile.data?.email,
          name: profile.data?.name,
          image: profile.data?.profile_image_url,
          type: "regular" as const,
        };
      },
    }),
          ]),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        console.log("[AUTHORIZE] start");
        const email = String(credentials.email ?? "");
        const password = String(credentials.password ?? "");
        console.log("[AUTHORIZE] email:", email);

        const users = await getUser(email);
        console.log("[AUTHORIZE] users found:", users.length);

        if (users.length === 0) {
          console.log("[AUTHORIZE] no user — returning null");
          await compare(password, DUMMY_PASSWORD);
          return null;
        }

        const [u] = users;

        if (!u.password) {
          console.log("[AUTHORIZE] no password — returning null");
          await compare(password, DUMMY_PASSWORD);
          return null;
        }

        const passwordsMatch = await compare(password, u.password);
        console.log("[AUTHORIZE] passwordsMatch:", passwordsMatch);

        if (!passwordsMatch) {
          console.log("[AUTHORIZE] wrong password — returning null");
          return null;
        }

        console.log("[AUTHORIZE] success — returning user");
        return { id: u.id, email: u.email, name: u.name, type: "regular" };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account, trigger, session }) {
      // Tue les sessions JWT "guest" legacy (cookies stateless qui
      // survivraient a la suppression du provider).
      if ((token.type as string) === "guest") {
        return null;
      }
      console.log("[AUTH-JWT] trigger:", trigger, "user:", user?.email);
      // Gérer la mise à jour de session déclenchée par update()
      if (trigger === "update" && session) {
        return {
          ...token,
          ...session,
          image: session.image ?? token.image,
          name: session.name ?? token.name,
          email: session.email ?? token.email,
        };
      }

      if (user) {
        // Si c'est une liaison de compte, on ne touche PAS à l'utilisateur
        if (user.isLink) {
          token.isLink = true;
          token.linkedProvider = account?.provider ?? "";
          token.linkedProfileId = user.id ?? "";
          token.linkedProfileName = user.name ?? "";
          // On ne retourne pas tout de suite pour ne pas perdre la session existante
        } else {
          token.id = user.id as string;
          token.type = user.type;
          token.image = user.image as string;
          token.name = user.name as string;
          token.email = user.email as string;
        }
      }

      // Créer l'utilisateur en DB UNIQUEMENT pour les connexions Google/GitHub
      const db = await getDb();
      if (
        !token.isLink &&
        account?.provider &&
        ["google", "github"].includes(account.provider)
      ) {
        const email = token.email ?? "";
        if (email) {
          try {
            const existing = await db
              .select()
              .from(userTable)
              .where(eq(userTable.email, email))
              .limit(1);
            if (existing.length > 0) {
              token.id = existing[0].id;
              token.type = "regular";
              token.image = existing[0].image as string;
              token.name = existing[0].name as string;
            } else {
              const [newUser] = await db
                .insert(userTable)
                .values({
                  email,
                  name: (token.name ?? "") as string,
                  image: (token.picture ?? "") as string,
                  emailVerified: true,
                } as any)
                .returning({ id: userTable.id });
              token.id = newUser.id;
              token.type = "regular";
            }
          } catch (err) {
            console.error("jwt DB error:", err);
          }
        }
      }

      return token;
    },
    session({ session, token }) {
      console.log("[AUTH-SESSION] session for:", session.user?.email);
      if (session.user) {
        session.user.id = token.id;
        session.user.type = token.type;
        session.user.image = token.image ?? session.user.image;
        session.user.name = token.name ?? session.user.name;
        session.user.email = token.email ?? session.user.email;

        // Transmettre les infos de liaison au client
        if (token.isLink) {
          (session as unknown as Record<string, unknown>).isLink = true;
          (session as unknown as Record<string, unknown>).linkedProvider =
            token.linkedProvider;
          (session as unknown as Record<string, unknown>).linkedProfileId =
            token.linkedProfileId;
          (session as unknown as Record<string, unknown>).linkedProfileName =
            token.linkedProfileName;
        }
      }
      return session;
    },
  },
});