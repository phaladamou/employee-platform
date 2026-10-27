// app/(legal)/terms/page.tsx
export const metadata = {
  title: "Terms of Service — Employee",
};

export default function TermsPage() {
  return (
    <article className="prose prose-neutral dark:prose-invert max-w-none">
      <h1 className="text-[28px] font-medium tracking-tight">
        Terms of Service
      </h1>

      <p className="mt-3 text-[13px] text-muted-foreground">
        Last updated: January 1, 2026
      </p>

      <p className="mt-8">
        These Terms of Service ("Terms") govern your access to and use of the
        services provided by Employee Inc ("Employee", "we", "us", or "our"),
        including our website, applications, and APIs (collectively, the
        "Service"). By accessing or using the Service, you agree to be bound by
        these Terms.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        1. Eligibility
      </h2>
      <p>
        You must be at least 18 years old and capable of forming a binding
        contract to use the Service. If you are using the Service on behalf of
        an organization, you represent that you have the authority to bind that
        organization to these Terms.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        2. Your Account
      </h2>
      <p>
        You are responsible for maintaining the confidentiality of your account
        credentials and for all activities that occur under your account. You
        agree to notify us immediately of any unauthorized use of your account.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        3. Acceptable Use
      </h2>
      <p>You agree not to use the Service to:</p>
      <ul className="mt-3 list-disc pl-6">
        <li>Violate any applicable law or regulation;</li>
        <li>Infringe the rights of any third party;</li>
        <li>Transmit any malicious code, virus, or harmful content;</li>
        <li>Attempt to gain unauthorized access to the Service or its related systems;</li>
        <li>Interfere with or disrupt the integrity or performance of the Service;</li>
        <li>Use the Service to develop a competing product.</li>
      </ul>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        4. Third-Party Services
      </h2>
      <p>
        The Service allows you to connect third-party services (such as GitHub,
        Notion, Slack, and others). Your use of those services is governed by
        their own terms and privacy policies. We are not responsible for the
        availability, accuracy, or content of third-party services.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        5. Intellectual Property
      </h2>
      <p>
        The Service, including all content, features, and functionality, is
        owned by Employee Inc and is protected by United States and international
        copyright, trademark, and other intellectual property laws. You retain
        all rights to the content you submit through the Service.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        6. Payment
      </h2>
      <p>
        Certain features of the Service may be subject to fees. You agree to pay
        all applicable fees in accordance with the pricing and payment terms
        presented to you. All fees are non-refundable unless otherwise stated.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        7. Termination
      </h2>
      <p>
        We may suspend or terminate your access to the Service at any time,
        with or without cause, and with or without notice. You may terminate
        your account at any time by using the account deletion feature in your
        settings.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        8. Disclaimer of Warranties
      </h2>
      <p>
        The Service is provided "as is" and "as available", without warranties
        of any kind, either express or implied, including but not limited to
        warranties of merchantability, fitness for a particular purpose, and
        non-infringement.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        9. Limitation of Liability
      </h2>
      <p>
        To the maximum extent permitted by law, Employee Inc shall not be liable
        for any indirect, incidental, special, consequential, or punitive
        damages, or any loss of profits or revenues, whether incurred directly
        or indirectly.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        10. Governing Law
      </h2>
      <p>
        These Terms shall be governed by and construed in accordance with the
        laws of the State of Delaware, United States, without regard to its
        conflict of law provisions.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        11. Changes to These Terms
      </h2>
      <p>
        We may update these Terms from time to time. We will notify you of any
        material changes by posting the new Terms on this page and updating the
        "Last updated" date.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        12. Contact
      </h2>
      <p>
        If you have any questions about these Terms, please contact us at{" "}
        <a
          className="text-foreground underline underline-offset-4"
          href="mailto:legal@employee.app"
        >
          legal@employee.app
        </a>
        .
      </p>
    </article>
  );
}
