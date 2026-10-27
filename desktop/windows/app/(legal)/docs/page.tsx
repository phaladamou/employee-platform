// app/(legal)/docs/page.tsx
import { ArrowUpRightIcon, BookOpenIcon, CodeIcon, PlugIcon } from "lucide-react";

export const metadata = {
  title: "Documentation — Employee",
};

const docs = [
  {
    icon: BookOpenIcon,
    title: "Getting started",
    description: "Learn the basics of Employee and set up your first workspace.",
    href: "https://docs.employee.app/getting-started",
  },
  {
    icon: PlugIcon,
    title: "Connectors",
    description: "Connect GitHub, Notion, Slack, and other services.",
    href: "https://docs.employee.app/connectors",
  },
  {
    icon: CodeIcon,
    title: "API Reference",
    description: "Integrate Employee into your own applications and workflows.",
    href: "https://docs.employee.app/api",
  },
];

export default function DocsPage() {
  return (
    <article>
      <h1 className="text-[28px] font-medium tracking-tight">
        Documentation
      </h1>

      <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
        Guides, references, and examples to help you build with Employee.
      </p>

      <div className="mt-10 flex flex-col gap-2">
        {docs.map((doc) => {
          const Icon = doc.icon;
          return (
            <a
              className="
                group flex items-start gap-4 rounded-xl border border-border/40
                bg-card p-5 transition-all duration-150
                hover:border-border hover:bg-muted/30
              "
              href={doc.href}
              key={doc.title}
              rel="noopener noreferrer"
              target="_blank"
            >
              <Icon
                className="mt-0.5 size-4 shrink-0 text-muted-foreground/70 transition-colors group-hover:text-foreground"
                strokeWidth={1.8}
              />

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-[13px] font-medium text-foreground">
                    {doc.title}
                  </h2>
                  <ArrowUpRightIcon
                    className="size-3 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground"
                    strokeWidth={2}
                  />
                </div>
                <p className="text-[12px] leading-relaxed text-muted-foreground">
                  {doc.description}
                </p>
              </div>
            </a>
          );
        })}
      </div>
    </article>
  );
}
