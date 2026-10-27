// app/(legal)/faq/page.tsx
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDownIcon } from "lucide-react";

export const metadata = {
  title: "FAQ — Employee",
};

const faq = [
  {
    id: "account",
    title: "Account",
    items: [
      {
        q: "How do I create an account?",
        a: "Click Sign up on the login page. You can use GitHub, Google, or your email address. No credit card required.",
      },
      {
        q: "Can I delete my account?",
        a: "Yes. Go to Settings, then scroll to the danger zone and click Delete account. Your data will be removed within 30 days.",
      },
      {
        q: "How do I change my email address?",
        a: "Go to Settings, then General. You'll be asked to confirm your new email address before it takes effect.",
      },
    ],
  },
  {
    id: "connectors",
    title: "Connectors",
    items: [
      {
        q: "What is a connector?",
        a: "A connector lets Employee act on your behalf in a third-party service like GitHub, Notion, or Slack. When you connect a service, you authorize Employee to access specific data or perform specific actions.",
      },
      {
        q: "Is my data safe?",
        a: "Yes. Access tokens are encrypted with AES-256-GCM before being stored. We never store your passwords, and you can revoke access at any time from the Connectors page.",
      },
      {
        q: "How do I disconnect a service?",
        a: "Go to Computer, then Connectors. Click on the service you want to disconnect, then click Disconnect in the confirmation dialog.",
      },
      {
        q: "Why is a connector grayed out?",
        a: "Some connectors are not yet configured. They will be enabled as they become available. You can still see what they will do by clicking on them.",
      },
    ],
  },
  {
    id: "billing",
    title: "Billing",
    items: [
      {
        q: "How much does Employee cost?",
        a: "Employee offers a free tier for personal use and paid plans for teams. See our Pricing page for details.",
      },
      {
        q: "Can I cancel anytime?",
        a: "Yes. You can cancel your subscription at any time from Settings, Billing. Your plan will remain active until the end of the billing period.",
      },
      {
        q: "Do you offer refunds?",
        a: "All fees are non-refundable unless otherwise stated. If you believe you were charged in error, contact support@employee.app.",
      },
    ],
  },
  {
    id: "security",
    title: "Security",
    items: [
      {
        q: "How is my data protected?",
        a: "We use industry-standard security measures: encryption in transit (TLS 1.3), encryption at rest (AES-256-GCM for tokens), access controls, and regular security reviews.",
      },
      {
        q: "Do you support two-factor authentication?",
        a: "Yes. You can enable 2FA from Settings, Security. We support TOTP authenticator apps.",
      },
      {
        q: "Where is my data stored?",
        a: "Your data is stored in the United States, with our infrastructure providers. See our Sub-processors page for the full list.",
      },
      {
        q: "How do I report a security issue?",
        a: "Please email security@employee.app. We take all reports seriously and will respond within 24 hours.",
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <article>
      <h1 className="text-[28px] font-medium tracking-tight">
        Frequently asked questions
      </h1>

      <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
        Everything you need to know about Employee. Can't find what you're looking
        for? Contact{" "}
        <a
          className="text-foreground underline underline-offset-4"
          href="mailto:support@employee.app"
        >
          support@employee.app
        </a>
        .
      </p>

      <div className="mt-10 flex flex-col gap-10">
        {faq.map((section) => (
          <section className="scroll-mt-20" id={section.id} key={section.id}>
            <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
              {section.title}
            </h2>

            <div className="flex flex-col gap-1">
              {section.items.map((item) => (
                <Collapsible key={item.q}>
                  <CollapsibleTrigger
                    className="
                      group flex w-full items-center justify-between
                      rounded-lg px-4 py-3 text-left
                      transition-colors hover:bg-muted/40
                    "
                  >
                    <span className="text-[13px] font-medium text-foreground">
                      {item.q}
                    </span>
                    <ChevronDownIcon
                      className="
                        size-3.5 shrink-0 text-muted-foreground/60
                        transition-transform duration-200
                        group-data-[state=open]:rotate-180
                      "
                      strokeWidth={2}
                    />
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <p className="px-4 pb-3 pt-1 text-[13px] leading-relaxed text-muted-foreground">
                      {item.a}
                    </p>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
