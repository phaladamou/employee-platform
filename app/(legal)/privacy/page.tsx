// app/(legal)/privacy/page.tsx
export const metadata = {
  title: "Privacy Policy — Employee",
};

export default function PrivacyPage() {
  return (
    <article className="prose prose-neutral dark:prose-invert max-w-none">
      <h1 className="text-[28px] font-medium tracking-tight">
        Privacy Policy
      </h1>

      <p className="mt-3 text-[13px] text-muted-foreground">
        Last updated: January 1, 2026
      </p>

      <p className="mt-8">
        This Privacy Policy describes how Employee Inc ("Employee", "we", "us", or
        "our") collects, uses, and shares information about you when you use
        our website, applications, and APIs (collectively, the "Service").
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        1. Information We Collect
      </h2>
      <p>We collect the following categories of information:</p>
      <ul className="mt-3 list-disc pl-6">
        <li>
          <strong>Account information</strong>: name, email address, profile
          picture, and authentication credentials.
        </li>
        <li>
          <strong>Usage information</strong>: how you interact with the
          Service, including features used, actions performed, and session
          data.
        </li>
        <li>
          <strong>Connected services</strong>: when you connect a third-party
          service (such as GitHub, Notion, or Slack), we store an encrypted
          access token to act on your behalf.
        </li>
        <li>
          <strong>Payment information</strong>: processed by our third-party
          payment provider (Stripe). We do not store card details.
        </li>
        <li>
          <strong>Technical information</strong>: IP address, browser type,
          operating system, and device identifiers.
        </li>
      </ul>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        2. How We Use Your Information
      </h2>
      <p>We use your information to:</p>
      <ul className="mt-3 list-disc pl-6">
        <li>Provide, maintain, and improve the Service;</li>
        <li>Authenticate you and secure your account;</li>
        <li>Execute actions you request through connected services;</li>
        <li>Send you transactional and service-related communications;</li>
        <li>Comply with legal obligations.</li>
      </ul>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        3. How We Share Your Information
      </h2>
      <p>
        We do not sell your personal information. We may share your information
        with:
      </p>
      <ul className="mt-3 list-disc pl-6">
        <li>
          <strong>Service providers</strong>: companies that help us operate
          the Service (hosting, database, analytics, payments). See our{" "}
          <a
            className="text-foreground underline underline-offset-4"
            href="/sub-processors"
          >
            Sub-processors
          </a>{" "}
          page.
        </li>
        <li>
          <strong>Legal authorities</strong>: when required by law or to protect
          our rights.
        </li>
        <li>
          <strong>Business transfers</strong>: in connection with a merger,
          acquisition, or sale of assets.
        </li>
      </ul>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        4. Data Retention
      </h2>
      <p>
        We retain your information for as long as your account is active or as
        needed to provide the Service. You can delete your account at any time,
        which will remove your personal information from our systems within 30
        days, except where we are required to retain it by law.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        5. Security
      </h2>
      <p>
        We use industry-standard security measures, including encryption in
        transit (TLS) and at rest (AES-256-GCM for tokens), to protect your
        information. However, no system is completely secure, and we cannot
        guarantee absolute security.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        6. Your Rights
      </h2>
      <p>
        Depending on your jurisdiction, you may have the right to access,
        correct, delete, or export your personal information. To exercise these
        rights, contact us at{" "}
        <a
          className="text-foreground underline underline-offset-4"
          href="mailto:privacy@employee.app"
        >
          privacy@employee.app
        </a>
        .
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        7. International Transfers
      </h2>
      <p>
        Your information may be transferred to and processed in the United
        States or other countries where our service providers operate. We take
        appropriate safeguards to ensure your information remains protected.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        8. Children's Privacy
      </h2>
      <p>
        The Service is not intended for children under 18. We do not knowingly
        collect personal information from children under 18.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        9. Changes to This Policy
      </h2>
      <p>
        We may update this Privacy Policy from time to time. We will notify you
        of any material changes by posting the new policy on this page.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        10. Contact
      </h2>
      <p>
        If you have any questions about this Privacy Policy, please contact us
        at{" "}
        <a
          className="text-foreground underline underline-offset-4"
          href="mailto:privacy@employee.app"
        >
          privacy@employee.app
        </a>
        .
      </p>
    </article>
  );
}
