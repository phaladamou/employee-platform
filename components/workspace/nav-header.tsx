"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/about", label: "About Employee" },
  { href: "/students", label: "For Students" },
  { href: "/developers", label: "For Developers" },
  { href: "/docs", label: "Docs" },
];

export function NavHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center justify-end bg-white dark:bg-background px-3 w-full">
      <nav className="flex items-center gap-1">
        {links.map((link) => (
          <Link
            className={cn(
              "px-3 py-1.5 text-[13px] text-muted-foreground/80 hover:text-foreground transition-colors rounded-lg hover:bg-muted/50",
              pathname === link.href && "text-foreground bg-muted/40"
            )}
            href={link.href}
            key={link.href}
          >
            {link.label}
          </Link>
        ))}
        <Link className="ml-2" href="/login">
          <Button className="h-8 rounded-lg bg-foreground text-background hover:bg-foreground/90 text-[13px] px-3.5 font-medium cursor-pointer">
            Sign in
          </Button>
        </Link>
      </nav>
    </header>
  );
}
