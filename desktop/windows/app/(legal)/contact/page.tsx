// app/(legal)/contact/page.tsx
export const metadata = {
  title: "Contact — Employee",
};

const channels = [
  {
    label: "General inquiries",
    email: "contact@employee.app",
    description: "Questions about Employee, partnerships, and press.",
  },
  {
    label: "Support",
    email: "support@employee.app",
    description: "Help with your account, employees, and missions.",
  },
  {
    label: "Privacy",
    email: "privacy@employee.app",
    description: "Data protection requests and privacy questions.",
  },
  {
    label: "Security",
    email: "security@employee.app",
    description: "Vulnerability reports and security concerns.",
  },
  {
    label: "Legal",
    email: "legal@employee.app",
    description: "Legal notices and compliance inquiries.",
  },
];

export default function ContactPage() {
  return (
    <article className="max-w-none">
      <h1 className="text-[28px] font-medium tracking-tight">Contact</h1>

      <p className="mt-8 text-[14px] leading-relaxed">
        Reach out to the right team directly — we read every message and aim
        to reply within two business days. If you already have an account,
        include the email address you signed up with so we can help faster.
      </p>

      <dl className="mt-10 divide-y divide-border/40 border-y border-border/40">
        {channels.map((channel) => (
          <div
            className="grid gap-1 py-5 sm:grid-cols-[180px_1fr] sm:gap-6"
            key={channel.email}
          >
            <dt className="text-[13px] font-medium">{channel.label}</dt>
            <dd>
              <a
                className="text-[14px] text-foreground underline underline-offset-4"
                href={`mailto:${channel.email}`}
              >
                {channel.email}
              </a>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {channel.description}
              </p>
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-10 text-[13px] leading-relaxed text-muted-foreground">
        Before writing in, you may find an answer in our{" "}
        <a
          className="text-foreground underline underline-offset-4"
          href="/faq"
        >
          FAQ
        </a>{" "}
        or{" "}
        <a className="text-foreground underline underline-offset-4" href="/help">
          Help
        </a>{" "}
        pages.
      </p>
    </article>
  );
}
