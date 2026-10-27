// components/simulations/simulation-sidebar.tsx
"use client";

import {
  BookOpenIcon,
  FlaskConicalIcon,
  PanelLeftIcon,
  StarIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "next-auth";
import { ScientiaLogo } from "@/components/workspace/scientia-logo";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CATEGORIES } from "@/lib/simulations/constants";

export function SimulationSidebar({ user }: { user: User | undefined }) {
  const router = useRouter();
  const pathname = usePathname();
  const { setOpenMobile, toggleSidebar } = useSidebar();

  const isFavorites = pathname === "/simulations/favorites";
  const isRecents = pathname === "/simulations/recents";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="pb-0 pt-3">
        <SidebarMenu>
          <SidebarMenuItem className="flex flex-row items-center justify-between">
            <div className="group/logo relative flex items-center justify-center">
              <SidebarMenuButton
                asChild
                className="size-16 !px-0 items-center justify-center group-data-[collapsible=icon]:group-hover/logo:opacity-0"
                tooltip="Scientia Labs"
              >
                <Link href="/" onClick={() => setOpenMobile(false)}>
                  <ScientiaLogo className="-mt-1" size={56} />
                </Link>
              </SidebarMenuButton>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarMenuButton
                    className="pointer-events-none absolute inset-0 size-16 opacity-0 group-data-[collapsible=icon]:pointer-events-auto group-data-[collapsible=icon]:group-hover/logo:opacity-100"
                    onClick={() => toggleSidebar()}
                  >
                    <PanelLeftIcon className="size-4" />
                  </SidebarMenuButton>
                </TooltipTrigger>
                <TooltipContent className="hidden md:block" side="right">
                  Open sidebar
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="group-data-[collapsible=icon]:hidden">
              <SidebarTrigger className="text-sidebar-foreground/60 transition-colors duration-150 hover:text-sidebar-foreground" />
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="pt-1 relative z-10">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className={`h-8 rounded-lg text-[13px] transition-colors duration-150 ${
                    pathname === "/simulations"
                      ? "bg-sidebar-accent/50 text-sidebar-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  }`}
                  onClick={() => {
                    setOpenMobile(false);
                    router.push("/simulations");
                  }}
                  tooltip="Laboratory"
                >
                  <FlaskConicalIcon className="size-4" />
                  <span className="font-medium">Laboratory</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className={`h-8 rounded-lg text-[13px] transition-colors duration-150 ${
                    isFavorites
                      ? "bg-sidebar-accent/50 text-sidebar-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  }`}
                  onClick={() => {
                    setOpenMobile(false);
                    router.push("/simulations/favorites");
                  }}
                  tooltip="Favorites"
                >
                  <StarIcon className="size-4" />
                  <span className="font-medium">Favorites</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className={`h-8 rounded-lg text-[13px] transition-colors duration-150 ${
                    isRecents
                      ? "bg-sidebar-accent/50 text-sidebar-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  }`}
                  onClick={() => {
                    setOpenMobile(false);
                    router.push("/simulations/recents");
                  }}
                  tooltip="Recents"
                >
                  <BookOpenIcon className="size-4" />
                  <span className="font-medium">Recents</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {CATEGORIES.map((cat) => (
                <SidebarMenuItem key={cat.id}>
                  <SidebarMenuButton
                    className={`h-8 rounded-lg text-[13px] transition-colors duration-150 ${
                      pathname === `/simulations/${cat.id}`
                        ? "bg-sidebar-accent/50 text-sidebar-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    }`}
                    onClick={() => {
                      setOpenMobile(false);
                      router.push(`/simulations/${cat.id}`);
                    }}
                    tooltip={cat.label}
                  >
                    <span className="text-sm">{cat.icon}</span>
                    <span className="font-medium">{cat.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border pt-2 pb-3 relative z-10">
        <div className="flex items-center gap-2 px-2 text-[11px] text-muted-foreground/50">
          Simulations
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
