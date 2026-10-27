// app/(legal)/help/page.tsx
import Link from "next/link";
import {
  BookOpenIcon,
  CreditCardIcon,
  LifeBuoyIcon,
  LockIcon,
  PlugIcon,
  UserIcon,
} from "lucide-react";

export const metadata = {
  title: "Help Center — Employee",
};

const categories = [
  {
    icon: UserIcon,
    title: "Account",
    description: "Create an account, sign in, manage your profile.",
    href: "/faq#account",
  },
  {
    icon: PlugIcon,
    title: "Connectors",
    description: "Connect third-party services like GitHub, Notion, Slack.",
    href: "/faq#connectors",
  },
  {
    icon: CreditCardIcon,
    title: "Billing",
    description: "Plans, payments, invoices, and subscriptions.",
    href: "/faq#billing",
  },
  {
    icon: LockIcon,
    title: "Security",
    description: "How we protect your data and your accounts.",
    href: "/faq#security",
  },
  {
    icon: BookOpenIcon,
    title: "Documentation",
    description: "Guides, API reference, and integration docs.",
    href: "/docs",
  },
  {
    icon: LifeBuoyIcon,
    title: "Contact support",
    description: "Can't find what you're looking for? Get in touch.",
    href: "mailto:support@employee.app",
  },
];

export default function HelpPage() {
  return (
    <article>
      <h1 className="text-[28px] font-medium tracking-tight">
        Help Center
      </h1>

      <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
        Find answers to common questions, browse documentation, or contact our
        support team.
      </p>

      <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {categories.map((category) => {
          const Icon = category.icon;
          return (
            <Link
              className="
                group flex flex-col gap-3 rounded-xl border border-border/40
                bg-card p-5 transition-all duration-150
                hover:border-border hover:bg-muted/30
              "
              href={category.href}
              key={category.title}
            >
              <Icon
                className="size-4 text-muted-foreground/70 transition-colors group-hover:text-foreground"
                strokeWidth={1.8}
              />

              <div className="flex flex-col gap-1">
                <h2 className="text-[13px] font-medium text-foreground">
                  {category.title}
                </h2>
                <p className="text-[12px] leading-relaxed text-muted-foreground">
                  {category.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-12 rounded-xl border border-border/40 bg-muted/20 p-6">
        <h2 className="text-[14px] font-medium text-foreground">
          Still need help?
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
          Our team typically responds within a few hours.
        </p>
        <a
          className="
            mt-4 inline-flex h-9 items-center gap-2 rounded-lg
            bg-foreground px-4 text-[13px] font-medium text-background
            transition-colors hover:bg-foreground/90
          "
          href="mailto:support@employee.app"
        >
          Contact support
        </a>
      </div>
    </article>
  );
}
