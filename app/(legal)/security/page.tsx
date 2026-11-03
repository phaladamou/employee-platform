// app/(legal)/security/page.tsx
export const metadata = {
  title: "Security — Employee",
};

export default function SecurityPage() {
  return (
    <article className="prose prose-neutral dark:prose-invert max-w-none">
      <h1 className="text-[28px] font-medium tracking-tight">Security</h1>

      <p className="mt-3 text-[13px] text-muted-foreground">
        Last updated: November 3, 2026
      </p>

      <p className="mt-8">
        Employee lets AI employees act on your behalf — connecting your tools,
        running missions, and producing work. That level of agency demands a
        high level of trust. This page describes how we protect your account
        and your data, and how to report a vulnerability.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        1. Authentication
      </h2>
      <p>
        Sign-in is fully passwordless: you receive a single-use code by email,
        valid for a few minutes. There is no password to leak, phish, or
        reuse. Sessions are managed server-side and expire automatically; you
        can sign out from all devices at any time from your settings.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        2. Encryption
      </h2>
      <ul className="mt-3 list-disc pl-6">
        <li>
          <strong>In transit</strong>: all traffic to the Service is encrypted
          with TLS.
        </li>
        <li>
          <strong>At rest</strong>: access tokens for connected third-party
          services (such as GitHub, Notion, or Slack) are stored encrypted
          with AES-256-GCM. On the desktop app, secrets are derived from a
          locally generated key that never leaves your machine.
        </li>
      </ul>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        3. Isolation
      </h2>
      <p>
        Every account is a separate tenant: employees, missions, and data are
        strictly scoped to the employer that owns them, and cross-tenant
        access is denied by default. Each AI employee works inside its own
        workspace, and shell execution on our backend runs under filesystem
        confinement with time and output limits — an employee cannot reach
        outside its assigned directory.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        4. Human Control
      </h2>
      <p>
        Sensitive tool uses require your explicit approval before they run.
        Every mission produces a verifiable record of what was done, and
        either a signed completion proof or an explicit request for human
        review when the outcome cannot be verified automatically.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        5. Your Data and AI Models
      </h2>
      <p>
        Your content is processed to run your missions — it is not used to
        train models. See our{" "}
        <a
          className="text-foreground underline underline-offset-4"
          href="/privacy"
        >
          Privacy Policy
        </a>{" "}
        and{" "}
        <a
          className="text-foreground underline underline-offset-4"
          href="/sub-processors"
        >
          Sub-processors
        </a>{" "}
        page for how data flows through our providers.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        6. Report a Vulnerability
      </h2>
      <p>
        If you discover a security vulnerability in the Service, please report
        it to{" "}
        <a
          className="text-foreground underline underline-offset-4"
          href="mailto:security@employee.app"
        >
          security@employee.app
        </a>
        . Include a description of the issue, the steps to reproduce it, and
        the potential impact. We ask that you:
      </p>
      <ul className="mt-3 list-disc pl-6">
        <li>
          Give us a reasonable time to fix the issue before any public
          disclosure;
        </li>
        <li>
          Avoid accessing, modifying, or deleting data that does not belong to
          you, and avoid degrading the Service for others;
        </li>
        <li>Act in good faith and within the scope of your own account.</li>
      </ul>
      <p>
        We will acknowledge your report promptly, keep you informed of our
        progress, and will not take legal action against researchers who
        follow these guidelines.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        7. Contact
      </h2>
      <p>
        For any other security question, contact us at{" "}
        <a
          className="text-foreground underline underline-offset-4"
          href="mailto:security@employee.app"
        >
          security@employee.app
        </a>
        .
      </p>
    </article>
  );
}
