// components/workspace/app-sidebar.tsx
"use client";

import {
  FileTextIcon,
  FlaskConicalIcon,
  HistoryIcon,
  MessageCircleIcon,
  MonitorIcon,
  MoreHorizontalIcon,
  PanelLeftIcon,
  PanelsTopLeftIcon,
  PenSquareIcon,
  SearchIcon,
  TerminalIcon,
  UserPlusIcon,
  UsersRoundIcon,
} from "lucide-react";

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import type { LucideIcon } from "lucide-react";
import useSWRInfinite from "swr/infinite";

import { ScientiaLogo } from "@/components/workspace/scientia-logo";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  getChatHistoryPaginationKey,
  SidebarHistory,
} from "@/components/workspace/sidebar-history";

import { SidebarUserNav } from "@/components/workspace/sidebar-user-nav";
import { NotificationsBell } from "@/components/workspace/notifications-bell";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

import type { Chat } from "@/lib/db/schema";
import { isEmployeesSection, isRecruitSection } from "@/lib/sidebar/nav-state";
import { cn, fetcher } from "@/lib/utils";

type NavGroup = "primary" | "secondary";

interface NavItem {
  route: string;
  isActive: boolean;
  icon: LucideIcon;
  label: string;
  group: NavGroup;
  external?: boolean;
  externalIcon?: boolean;
  isHistory?: boolean;
  isPlus?: boolean;
}

function HistoryTooltipContent() {
  const t = useTranslations("chat");
  const { data: rawSession } = useSession();
  const [cachedUser, setCachedUser] = useState(rawSession?.user);

  useEffect(() => {
    if (rawSession?.user) {
      setCachedUser(rawSession.user);
    }
  }, [rawSession?.user]);

  const user = rawSession?.user ?? cachedUser;
  const router = useRouter();

  const { data, isLoading, setSize, size, isValidating } = useSWRInfinite<{
    chats: Chat[];
    hasMore: boolean;
  }>(user ? getChatHistoryPaginationKey : () => null, fetcher, {
    initialSize: 1,
  });

  const chats = data?.flatMap((page) => page.chats) ?? [];
  const hasMore = data?.[data.length - 1]?.hasMore ?? false;

  return (
    <div className="w-64 overflow-hidden rounded-xl border border-border/70 bg-card shadow-lg">
      <div className="border-b border-border/60 px-3.5 py-3">
        <h3 className="text-xs font-semibold text-foreground">
          {t("history")}
        </h3>
      </div>

      <div
        className="max-h-64 overflow-y-auto"
        onScroll={(e) => {
          const el = e.currentTarget;

          if (
            el.scrollHeight - el.scrollTop - el.clientHeight < 20 &&
            hasMore &&
            !isValidating
          ) {
            setSize(size + 1);
          }
        }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <div className="size-3 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          </div>
        ) : chats.length === 0 ? (
          <div className="px-3 py-5 text-center text-[11px] text-muted-foreground">
            {t("noChats")}
          </div>
        ) : (
          <div className="space-y-0.5 p-1.5">
            {chats.map((chat) => (
              <button
                className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12px] text-foreground/80 transition-colors hover:bg-muted/70 hover:text-foreground"
                key={chat.id}
                onClick={() => router.push(`/workspace/${chat.id}`)}
                type="button"
              >
                <MessageCircleIcon className="size-3 shrink-0 text-muted-foreground" />
                <span className="truncate">{chat.title}</span>
              </button>
            ))}

            {hasMore && (
              <div className="flex items-center justify-center py-2">
                <div className="size-3 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function AppSidebar() {
  const t = useTranslations("sidebar");

  const { data: rawSession } = useSession();
  const [cachedUser, setCachedUser] = useState(rawSession?.user);

  useEffect(() => {
    if (rawSession?.user) {
      setCachedUser(rawSession.user);
    }
  }, [rawSession?.user]);

  const user = rawSession?.user ?? cachedUser;

  const router = useRouter();
  const pathname = usePathname();

  const { setOpenMobile, toggleSidebar } = useSidebar();

  const isWorkspace = pathname.startsWith("/workspace");
  const isComputer = pathname.startsWith("/computer");
  const isCli = pathname.startsWith("/cli");
  const isEmployees = isEmployeesSection(pathname);
  const isRecruit = isRecruitSection(pathname);

  const navItems: NavItem[] = [
    {
      route: "/workspace",
      isActive: isWorkspace,
      icon: PenSquareIcon,
      label: "Workspace",
      group: "primary",
    },
    {
      route: "/computer",
      isActive: isComputer,
      icon: MonitorIcon,
      label: "Computer",
      group: "primary",
    },
    {
      route: "/cli",
      isActive: isCli,
      icon: TerminalIcon,
      label: "CLI",
      group: "primary",
    },
    {
      route: "/employees",
      isActive: isEmployees,
      icon: UsersRoundIcon,
      label: t("employees"),
      group: "secondary",
    },
    {
      route: "plus",
      isActive: false,
      icon: MoreHorizontalIcon,
      label: "Plus",
      group: "secondary",
      isPlus: true,
    },
    {
      route: "history",
      isActive: false,
      icon: HistoryIcon,
      label: t("history"),
      group: "secondary",
      isHistory: true,
    },
  ];

  const moreItems: NavItem[] = [
    {
      route: "/websites",
      isActive: pathname.startsWith("/websites"),
      icon: PanelsTopLeftIcon,
      label: t("websites"),
      group: "secondary",
    },
    {
      route: "/artefacts",
      isActive: pathname.startsWith("/artefacts"),
      icon: FileTextIcon,
      label: t("artefacts"),
      group: "secondary",
    },
    {
      route: "/simulations",
      isActive: false,
      icon: FlaskConicalIcon,
      label: t("simulations"),
      group: "secondary",
      external: true,
      externalIcon: true,
    },
  ];

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;

    // History
    if (item.isHistory) {
      return (
        <SidebarMenuItem
          className="hidden group-data-[collapsible=icon]:block"
          key={item.route}
        >
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <SidebarMenuButton
                className={cn(
                  "h-9 cursor-pointer rounded-lg px-3",
                  "text-[13px] font-normal",
                  "group-data-[collapsible=icon]:mx-auto",
                  "text-sidebar-foreground/55",
                  "transition-colors duration-150",
                  "hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
                )}
              >
                <div className="flex flex-1 items-center gap-3">
                  <HistoryIcon className="size-4 shrink-0" />
                  <span className="group-data-[collapsible=icon]:hidden">
                    {item.label}
                  </span>
                </div>
              </SidebarMenuButton>
            </TooltipTrigger>

            <TooltipContent
              align="start"
              className="theme-light border-0 bg-transparent p-0 shadow-none [&>span]:hidden"
              side="right"
              sideOffset={8}
            >
              <HistoryTooltipContent />
            </TooltipContent>
          </Tooltip>
        </SidebarMenuItem>
      );
    }

    // Plus
    if (item.isPlus) {
      return (
        <SidebarMenuItem key={item.route}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                className={cn(
                  "group/nav h-9 cursor-pointer rounded-lg px-3",
                  "text-[13px] font-normal",
                  "transition-colors duration-150",
                  "group-data-[collapsible=icon]:mx-auto",
                  "text-sidebar-foreground/55 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
                )}
                tooltip={item.label}
              >
                <div className="flex flex-1 items-center gap-3">
                  <Icon className="size-4 shrink-0 opacity-75 group-hover/nav:opacity-100" />
                  <span className="whitespace-nowrap">{item.label}</span>
                </div>
              </SidebarMenuButton>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="start"
              className="theme-light w-56 rounded-xl border border-border/40 bg-card/95 p-1.5 shadow-[var(--shadow-float)] backdrop-blur-xl"
              side="right"
              sideOffset={4}
            >
              {moreItems.map((moreItem) => {
                const MoreIcon = moreItem.icon;

                return (
                  <DropdownMenuItem
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-colors hover:bg-sidebar-accent/50 focus:bg-sidebar-accent/50",
                      moreItem.isActive && "bg-sidebar-accent/60"
                    )}
                    key={moreItem.route}
                    onClick={() => {
                      setOpenMobile(false);
                      if (moreItem.external) {
                        window.open(moreItem.route, "_blank");
                      } else {
                        router.push(moreItem.route);
                      }
                    }}
                  >
                    <MoreIcon
                      className={cn(
                        "size-4 shrink-0",
                        moreItem.isActive
                          ? "text-sidebar-foreground"
                          : "text-sidebar-foreground/50"
                      )}
                    />
                    <span className="flex-1">{moreItem.label}</span>

                    {moreItem.externalIcon && (
                      <svg
                        className="size-3 text-muted-foreground/30"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2.5"
                        viewBox="0 0 24 24"
                      >
                        <path d="M7 17L17 7M17 7H9M17 7V15" />
                      </svg>
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      );
    }

    // Item normal
    return (
      <SidebarMenuItem key={item.route}>
        <SidebarMenuButton
          className={cn(
            "group/nav h-9 cursor-pointer rounded-lg px-3",
            "text-[13px] font-normal",
            "transition-colors duration-150",
            "group-data-[collapsible=icon]:mx-auto",
            item.isActive
              ? "bg-sidebar-accent text-sidebar-foreground shadow-sm"
              : "text-sidebar-foreground/55 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
          )}
          onClick={() => {
            setOpenMobile(false);
            router.push(item.route);
          }}
          tooltip={item.label}
        >
          <div className="flex flex-1 items-center gap-3">
            <Icon
              className={cn(
                "size-4 shrink-0 transition-opacity duration-150",
                item.isActive
                  ? "opacity-100"
                  : "opacity-75 group-hover/nav:opacity-100"
              )}
            />
            <span className="whitespace-nowrap">{item.label}</span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar
      className="
        border-r border-sidebar-border
        [&>div]:!bg-zinc-50
      "
      collapsible="icon"
    >
      {/* Header */}
      <SidebarHeader className="px-2 pb-2 pt-3">
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center justify-between">
            <div className="group/logo relative flex min-w-0 flex-1 items-center">
              <SidebarMenuButton
                asChild
                className="
                  h-14 w-auto min-w-0 justify-start !px-2
                  group-data-[collapsible=icon]:size-12!
                  group-data-[collapsible=icon]:!p-0
                  group-data-[collapsible=icon]:justify-center
                  group-data-[collapsible=icon]:group-hover/logo:opacity-0
                "
                tooltip="Employee"
              >
                <Link
                  className="flex items-center gap-3"
                  href="/"
                  onClick={() => setOpenMobile(false)}
                >
                  <ScientiaLogo className="shrink-0" size={42} />

                  <span className="truncate text-[14px] font-semibold tracking-tight text-foreground group-data-[collapsible=icon]:hidden">
                    Employee
                  </span>
                </Link>
              </SidebarMenuButton>

              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarMenuButton
                    className="
                      pointer-events-none absolute inset-0 size-12
                      opacity-0 transition-opacity duration-200 ease-out
                      group-data-[collapsible=icon]:pointer-events-auto
                      group-data-[collapsible=icon]:size-full!
                      group-data-[collapsible=icon]:!p-0
                      group-data-[collapsible=icon]:justify-center
                      group-data-[collapsible=icon]:group-hover/logo:opacity-100
                    "
                    onClick={() => toggleSidebar()}
                  >
                    <PanelLeftIcon className="size-4" />
                  </SidebarMenuButton>
                </TooltipTrigger>

                <TooltipContent className="hidden md:block" side="right">
                  {t("openSidebar")}
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="flex items-center gap-1 group-data-[collapsible=icon]:hidden">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/search">
                    <SidebarMenuButton className="size-8 cursor-pointer text-black/50 transition-colors duration-150 hover:text-black">
                      <SearchIcon className="size-4" />
                    </SidebarMenuButton>
                  </Link>
                </TooltipTrigger>
                <TooltipContent className="hidden md:block" side="bottom">
                  {t("search")}
                </TooltipContent>
              </Tooltip>

              <SidebarTrigger className="cursor-pointer text-black/50 transition-colors duration-150 hover:text-black" />
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Navigation principale */}
      <div className="shrink-0 px-2">
        <SidebarGroup className="relative z-10 px-0 pt-2">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {navItems.map((item, index) => {
                const prevItem = navItems[index - 1];
                const needsSpace =
                  prevItem && prevItem.group !== item.group;

                return (
                  <Fragment key={item.route}>
                    {needsSpace && <div className="mt-4" />}
                    {renderNavItem(item)}
                  </Fragment>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </div>

      {/* Historique (scrollable) */}
      <SidebarContent className="px-2">
        <SidebarHistory user={user} />
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="relative z-10 border-t border-black/5 px-2 pb-3 pt-2">
        <SidebarMenu className="gap-1">
          <SidebarMenuItem>
            <SidebarMenuButton
              className={cn(
                "group/nav h-9 cursor-pointer rounded-lg px-3",
                "text-[13px] font-normal",
                "transition-colors duration-150",
                "group-data-[collapsible=icon]:mx-auto",
                isRecruit
                  ? "bg-sidebar-accent text-sidebar-foreground shadow-sm"
                  : "text-sidebar-foreground/55 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
              )}
              onClick={() => {
                setOpenMobile(false);
                router.push("/employees/recruit");
              }}
              tooltip={t("recruit")}
            >
              <div className="flex flex-1 items-center gap-3 group-data-[collapsible=icon]:justify-center">
                <UserPlusIcon
                  className={cn(
                    "size-4 shrink-0 transition-opacity duration-150",
                    isRecruit
                      ? "opacity-100"
                      : "opacity-75 group-hover/nav:opacity-100"
                  )}
                />
                <span className="whitespace-nowrap group-data-[collapsible=icon]:hidden">{t("recruit")}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarUserNav user={user} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
