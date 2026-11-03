// app/(legal)/legal-notice/page.tsx
export const metadata = {
  title: "Legal Notice — Employee",
};

export default function LegalNoticePage() {
  return (
    <article className="prose prose-neutral dark:prose-invert max-w-none">
      <h1 className="text-[28px] font-medium tracking-tight">Legal Notice</h1>

      <p className="mt-3 text-[13px] text-muted-foreground">
        Last updated: November 3, 2026
      </p>

      <p className="mt-8">
        This legal notice identifies the publisher of the Employee service and
        provides the information required by applicable law.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        1. Publisher
      </h2>
      <p>
        The website, applications, and APIs available under the Employee brand
        (collectively, the "Service") are published and operated by Employee
        Inc ("Employee", "we", "us", or "our").
      </p>
      <p>
        For any legal inquiry, contact us at{" "}
        <a
          className="text-foreground underline underline-offset-4"
          href="mailto:legal@employee.app"
        >
          legal@employee.app
        </a>
        .
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        2. Hosting
      </h2>
      <p>The Service is hosted by the following providers:</p>
      <ul className="mt-3 list-disc pl-6">
        <li>Application hosting and edge network: Vercel Inc.</li>
        <li>Database (serverless Postgres): Neon, Inc.</li>
      </ul>
      <p>
        A full list of our service providers is available on our{" "}
        <a
          className="text-foreground underline underline-offset-4"
          href="/sub-processors"
        >
          Sub-processors
        </a>{" "}
        page.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        3. Intellectual Property
      </h2>
      <p>
        Unless otherwise stated, all content, features, and functionality of
        the Service — including text, graphics, logos, and software — are the
        exclusive property of Employee Inc and are protected by applicable
        intellectual property laws. You retain all rights to the content you
        submit through the Service. See our{" "}
        <a
          className="text-foreground underline underline-offset-4"
          href="/terms"
        >
          Terms of Service
        </a>{" "}
        for details.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        4. Liability
      </h2>
      <p>
        Employee strives to keep the information on this Service accurate and
        up to date but makes no warranty as to its completeness or accuracy.
        Use of the Service is governed by our{" "}
        <a
          className="text-foreground underline underline-offset-4"
          href="/terms"
        >
          Terms of Service
        </a>{" "}
        and{" "}
        <a
          className="text-foreground underline underline-offset-4"
          href="/privacy"
        >
          Privacy Policy
        </a>
        .
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        5. Contact
      </h2>
      <p>
        For any question related to this legal notice, please contact us at{" "}
        <a
          className="text-foreground underline underline-offset-4"
          href="mailto:legal@employee.app"
        >
          legal@employee.app
        </a>
        . For general inquiries, see our{" "}
        <a
          className="text-foreground underline underline-offset-4"
          href="/contact"
        >
          Contact
        </a>{" "}
        page.
      </p>
    </article>
  );
}
