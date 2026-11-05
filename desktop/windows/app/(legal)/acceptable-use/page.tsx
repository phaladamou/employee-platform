// app/(legal)/acceptable-use/page.tsx
export const metadata = {
  title: "Acceptable Use Policy — Employee",
};

export default function AcceptableUsePage() {
  return (
    <article className="prose prose-neutral dark:prose-invert max-w-none">
      <h1 className="text-[28px] font-medium tracking-tight">
        Acceptable Use Policy
      </h1>

      <p className="mt-3 text-[13px] text-muted-foreground">
        Last updated: November 3, 2026
      </p>

      <p className="mt-8">
        This Acceptable Use Policy ("Policy") describes what you may and may
        not do with the services provided by Employee Inc ("Employee", "we",
        "us", or "our"), including our website, applications, AI employees,
        and APIs (collectively, the "Service"). It forms part of our{" "}
        <a
          className="text-foreground underline underline-offset-4"
          href="/terms"
        >
          Terms of Service
        </a>
        . Violating this Policy may result in suspension or termination of your
        account.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        1. General Prohibitions
      </h2>
      <p>You agree not to use the Service to:</p>
      <ul className="mt-3 list-disc pl-6">
        <li>Violate any applicable law or regulation;</li>
        <li>
          Infringe the intellectual property, privacy, or other rights of any
          third party;
        </li>
        <li>
          Create, upload, or distribute malware, spam, or any harmful or
          deceptive content;
        </li>
        <li>
          Harass, threaten, or abuse any person, or produce hateful or
          discriminatory content;
        </li>
        <li>
          Attempt to gain unauthorized access to the Service, other users'
          accounts, or connected third-party services;
        </li>
        <li>
          Interfere with or disrupt the integrity, security, or performance of
          the Service, including by excessive or automated use that degrades
          the Service for others.
        </li>
      </ul>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        2. AI-Specific Rules
      </h2>
      <p>
        Employee provides AI employees that act on your behalf — running
        missions, using tools, and accessing services you connect. Because
        these agents can take real-world actions, the following rules apply in
        addition to the above:
      </p>
      <ul className="mt-3 list-disc pl-6">
        <li>
          Do not attempt to bypass, disable, or manipulate the safety controls
          of an AI employee, including tool approvals, sandboxing, and
          permission scopes;
        </li>
        <li>
          Do not use prompt injection or other techniques to make an AI
          employee act against its instructions or against the interests of
          its employer;
        </li>
        <li>
          Do not use AI employees to attack, probe, or exploit third-party
          systems, or to exfiltrate data you are not entitled to access;
        </li>
        <li>
          Do not attempt to access another employer's employees, missions, or
          data, including through shared or public contexts;
        </li>
        <li>
          Do not misrepresent AI-generated output as human work where that
          distinction matters (for example in legal, hiring, or compliance
          contexts) without appropriate human review.
        </li>
      </ul>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        3. Platform Integrity
      </h2>
      <p>You agree not to:</p>
      <ul className="mt-3 list-disc pl-6">
        <li>
          Reverse engineer the Service to circumvent technical limitations,
          usage quotas, or access controls;
        </li>
        <li>
          Resell, sublicense, or provide access to the Service to third parties
          outside of your organization without our authorization;
        </li>
        <li>
          Use the Service to develop a competing product, or to train machine
          learning models on output of the Service in violation of our Terms;
        </li>
        <li>
          Remove, obscure, or alter any notice of intellectual property or
          provenance attached to the Service or its output.
        </li>
      </ul>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        4. Enforcement
      </h2>
      <p>
        We may investigate any suspected violation of this Policy and take
        appropriate action, including warning, restricting features, or
        suspending or terminating your account, with or without prior notice.
        We may also remove content that violates this Policy and report
        unlawful activity to the competent authorities where required.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        5. Reporting Abuse
      </h2>
      <p>
        If you become aware of a violation of this Policy, please report it to{" "}
        <a
          className="text-foreground underline underline-offset-4"
          href="mailto:security@employee.app"
        >
          security@employee.app
        </a>{" "}
        with as much detail as possible. Security vulnerabilities are handled
        under our{" "}
        <a
          className="text-foreground underline underline-offset-4"
          href="/security"
        >
          Security
        </a>{" "}
        disclosure process.
      </p>
    </article>
  );
}
