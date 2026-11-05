// app/(legal)/layout.tsx
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { BackButton } from "@/components/workspace/back-button";

const footerGroups = [
  {
    label: "Product",
    links: [
      { label: "About", href: "/about" },
      { label: "Changelog", href: "/changelog" },
      { label: "Status", href: "/status" },
      { label: "Brand", href: "/brand" },
    ],
  },
  {
    label: "Legal",
    links: [
      { label: "Terms", href: "/terms" },
      { label: "Privacy", href: "/privacy" },
      { label: "DPA", href: "/dpa" },
      { label: "Sub-processors", href: "/sub-processors" },
      { label: "Retention", href: "/retention" },
      { label: "Acceptable Use", href: "/acceptable-use" },
      { label: "Legal Notice", href: "/legal-notice" },
    ],
  },
  {
    label: "Trust",
    links: [
      { label: "Security", href: "/security" },
      { label: "Disclosure", href: "/vulnerability-disclosure" },
      { label: "AI Governance", href: "/ai-governance" },
    ],
  },
  {
    label: "Company",
    links: [
      { label: "Contact", href: "/contact" },
      { label: "Careers", href: "/careers" },
      { label: "Press", href: "/press" },
      { label: "Partnerships", href: "/partnerships" },
    ],
  },
];

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh w-full bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-8 sm:px-12 md:px-16">
          <BackButton />

          <span className="text-[13px] font-medium tracking-tight">
            Employee Inc
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-8 py-16 sm:px-12 md:px-16">
        {children}
      </main>

      <footer className="border-t border-border/40">
        <div className="mx-auto grid w-full max-w-3xl grid-cols-2 gap-8 px-8 py-10 sm:grid-cols-4 sm:px-12 md:px-16">
          {footerGroups.map((group) => (
            <nav key={group.label}>
              <p className="text-[12px] font-medium text-foreground">
                {group.label}
              </p>
              <ul className="mt-3 space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      className="text-[12px] text-muted-foreground hover:text-foreground"
                      href={link.href}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="border-t border-border/40">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-8 py-4 text-[12px] text-muted-foreground/60 sm:px-12 md:px-16">
            <span>Employee Inc</span>
            <span>© {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
