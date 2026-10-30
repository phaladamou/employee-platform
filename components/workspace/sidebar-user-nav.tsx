// components/workspace/sidebar-user-nav.tsx
"use client";

import {
  ChevronsUpDown,
  GlobeIcon,
  HelpCircleIcon,
  InfoIcon,
  LanguagesIcon,
  LogOut,
  Settings2Icon,
  SparklesIcon,
  User,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { User as NextAuthUser } from "next-auth";
import { signOut } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import useSWR from "swr";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { clearStickyUser } from "@/lib/auth/sticky-session";
import { NotificationsBell } from "./notifications-bell";
import { toast } from "./toast";
import { useStickySession } from "./use-sticky-session";

function getDisplayName(user?: NextAuthUser): string {
  if (!user) return "User";
  if (user.name) return user.name;
  if (user.email) return user.email.split("@")[0];
  return "User";
}

function getInitials(user?: NextAuthUser): string {
  if (!user) return "U";
  const name = user.name?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (user.email) {
    const emailName = user.email.split("@")[0].replace(/[^a-zA-Z]/g, "");
    return emailName.slice(0, 2).toUpperCase() || "U";
  }
  return "U";
}

function UserAvatar({
  user,
  size,
  showImage = false,
}: {
  user?: NextAuthUser;
  size: "small" | "large";
  showImage?: boolean;
}) {
  const image = user?.image;
  const initials = getInitials(user);
  const displayName = getDisplayName(user);

  if (showImage && image) {
    return (
      <div
        className={
          size === "small"
            ? "relative size-8 shrink-0 overflow-hidden rounded-full ring-1 ring-sidebar-border/50"
            : "relative size-10 shrink-0 overflow-hidden rounded-full ring-1 ring-sidebar-border/50"
        }
      >
        <Image
          alt={displayName}
          className="object-cover"
          fill
          sizes={size === "small" ? "32px" : "40px"}
          src={image}
          unoptimized
        />
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className={
        size === "small"
          ? "flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-500/10"
          : "flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-[13px] font-semibold tracking-tight text-emerald-700 ring-1 ring-emerald-500/10"
      }
    >
      {initials}
    </div>
  );
}

const menuItemClass =
  "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-colors hover:bg-sidebar-accent/50 focus:bg-sidebar-accent/50";

export function SidebarUserNav({ user }: { user?: NextAuthUser }) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  // Sticky : une coupure serveur ne doit pas afficher l'etat "login".
  // Seul un logout confirme (sonde serveur) fait basculer.
  const { user: stickyUser, status } = useStickySession();
  const t = useTranslations("auth");
  const tMenu = useTranslations("userMenu");

  const { data: freshUser } = useSWR(
    status === "authenticated" ? "/api/user" : null,
    async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch user");
      const data = await res.json();
      return data.user;
    },
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 2000,
    }
  );

  const currentUser = freshUser ?? stickyUser ?? user;
  const displayName = getDisplayName(currentUser);

  const changeLocale = (nextLocale: string) => {
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length > 0 && ["en", "fr", "zh"].includes(segments[0])) {
      segments.shift();
    }
    const nextPath = `/${nextLocale}${segments.length > 0 ? `/${segments.join("/")}` : ""}`;
    router.push(nextPath);
  };

  if (status !== "authenticated") {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            className="h-10 cursor-pointer rounded-lg bg-transparent text-sidebar-foreground/50 transition-colors duration-150 hover:text-sidebar-foreground group-data-[collapsible=icon]:mx-auto"
            onClick={() => router.push("/login")}
            tooltip={t("login")}
          >
            <div className="flex flex-1 flex-row items-center gap-2 group-data-[collapsible=icon]:justify-center">
              <User className="size-4 shrink-0" />
              <span className="text-[13px] group-data-[collapsible=icon]:hidden">
                {t("login")}
              </span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <div className="flex w-full items-center gap-1 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-2">
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton className="h-12 flex-1 cursor-pointer rounded-lg bg-transparent px-2.5 text-sidebar-foreground/70 transition-colors duration-150 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-12! group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0!">
                <UserAvatar size="small" user={currentUser} />

                <span className="flex-1 truncate text-[13px] font-medium group-data-[collapsible=icon]:hidden">
                  {displayName}
                </span>

                <ChevronsUpDown className="size-3.5 shrink-0 text-sidebar-foreground/30 group-data-[collapsible=icon]:hidden" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>

            <div className="group-data-[collapsible=icon]:order-first">
              <NotificationsBell />
            </div>
          </div>

          <DropdownMenuContent
            align="start"
            className="theme-light w-56 rounded-xl border border-border/40 bg-card/95 p-1.5 shadow-[var(--shadow-float)] backdrop-blur-xl"
            data-testid="user-nav-menu"
            side="top"
            sideOffset={8}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-2.5 py-2">
              <UserAvatar size="large" user={currentUser} />

              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-sidebar-foreground">
                  {displayName}
                </p>
                <p className="truncate text-[12px] text-sidebar-foreground/50">
                  {currentUser?.email ?? "—"}
                </p>
              </div>
            </div>

            <DropdownMenuSeparator className="mx-2 my-1.5 bg-sidebar-border/40" />

            {/* Settings */}
            <DropdownMenuItem
              className={menuItemClass}
              onClick={() => router.push("/settings/general")}
            >
              <Settings2Icon className="size-4 text-sidebar-foreground/50" />
              <span className="flex-1">{tMenu("settings")}</span>
              <span className="text-[11px] text-sidebar-foreground/40">
                ⌃⇧,
              </span>
            </DropdownMenuItem>

            {/* Language */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className={menuItemClass}>
                <LanguagesIcon className="size-4 text-sidebar-foreground/50" />
                <span className="flex-1">{tMenu("language")}</span>
              </DropdownMenuSubTrigger>

              <DropdownMenuSubContent
                align="end"
                className="w-52 rounded-xl border border-border/40 bg-card/95 p-1.5 shadow-[var(--shadow-float)] backdrop-blur-xl"
                sideOffset={4}
              >
                {[
                  { id: "en", label: "English" },
                  { id: "fr", label: "Français" },
                  { id: "zh", label: "中文" },
                ].map((item) => (
                  <DropdownMenuItem
                    className={cn(
                      menuItemClass,
                      locale === item.id && "bg-sidebar-accent/60"
                    )}
                    key={item.id}
                    onClick={() => changeLocale(item.id)}
                  >
                    <GlobeIcon className="size-4 text-sidebar-foreground/50" />
                    <span className="flex-1">{item.label}</span>
                    {locale === item.id && (
                      <span className="text-[11px] text-sidebar-foreground/40">
                        ✓
                      </span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            {/* Get help */}
            <DropdownMenuItem
              className={menuItemClass}
              onClick={() => router.push("/help")}
            >
              <HelpCircleIcon className="size-4 text-sidebar-foreground/50" />
              <span className="flex-1">{tMenu("getHelp")}</span>
            </DropdownMenuItem>

            {/* Upgrade plan */}
            <DropdownMenuItem
              className={menuItemClass}
              onClick={() => router.push("/settings/billing")}
            >
              <SparklesIcon className="size-4 text-sidebar-foreground/50" />
              <span className="flex-1">{tMenu("upgrade")}</span>
            </DropdownMenuItem>

            {/* Learn more (sub-menu with legal pages) */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className={menuItemClass}>
                <InfoIcon className="size-4 text-sidebar-foreground/50" />
                <span className="flex-1">{tMenu("learnMore")}</span>
              </DropdownMenuSubTrigger>

              <DropdownMenuSubContent align="end" className="w-52 rounded-xl border border-border/40 bg-card/95 p-1.5 shadow-[var(--shadow-float)] backdrop-blur-xl" sideOffset={4}>
                <DropdownMenuItem
                  className={menuItemClass}
                  onClick={() => router.push("/terms")}
                >
                  <span className="flex-1">{tMenu("terms")}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={menuItemClass}
                  onClick={() => router.push("/privacy")}
                >
                  <span className="flex-1">{tMenu("privacy")}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={menuItemClass}
                  onClick={() => router.push("/dpa")}
                >
                  <span className="flex-1">{tMenu("dpa")}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={menuItemClass}
                  onClick={() => router.push("/sub-processors")}
                >
                  <span className="flex-1">{tMenu("subProcessors")}</span>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSeparator className="mx-2 my-1.5 bg-sidebar-border/40" />

            {/* Log out */}
            <DropdownMenuItem
              className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-red-500 transition-colors hover:bg-red-500/10 focus:bg-red-500/10"
              onSelect={() => {
                // Logout explicite : purge la reference sticky AVANT
                // signOut, pour ne jamais reafficher l'etat connecte.
                clearStickyUser();
                // Pattern officiel NextAuth : signOut detruit la session
                // puis recharge la page vers callbackUrl. Fallback vers
                // /login si la requete echoue (aucun toast, aucun blocage).
                signOut({ callbackUrl: "/login" })
                  .then(() => {
                    window.location.replace("/login");
                  })
                  .catch((error: unknown) => {
                    console.error("[LOGOUT] signOut error:", error);
                    window.location.replace("/login");
                  });
              }}
            >
              <LogOut className="size-4" />
              <span className="flex-1">{tMenu("logOut")}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
