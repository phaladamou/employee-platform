// app/(legal)/dpa/page.tsx
export const metadata = {
  title: "Data Processing Agreement — Employee",
};

export default function DpaPage() {
  return (
    <article className="prose prose-neutral dark:prose-invert max-w-none">
      <h1 className="text-[28px] font-medium tracking-tight">
        Data Processing Agreement
      </h1>

      <p className="mt-3 text-[13px] text-muted-foreground">
        Last updated: January 1, 2026
      </p>

      <p className="mt-8">
        This Data Processing Agreement ("DPA") forms part of the Terms of
        Service between Employee Inc ("Processor") and the customer ("Controller")
        and applies to the processing of personal data by Employee on behalf of
        the Controller.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        1. Definitions
      </h2>
      <p>
        "Personal Data", "Processing", "Controller", "Processor", "Data
        Subject", and "Supervisory Authority" have the meanings given in the
        GDPR (Regulation (EU) 2016/679) or applicable data protection law.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        2. Scope and Purpose
      </h2>
      <p>
        Employee processes Personal Data solely for the purpose of providing the
        Service, as described in the Terms of Service, and in accordance with
        the Controller's documented instructions.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        3. Obligations of the Processor
      </h2>
      <p>Employee shall:</p>
      <ul className="mt-3 list-disc pl-6">
        <li>Process Personal Data only on documented instructions from the Controller;</li>
        <li>Ensure that persons authorized to process Personal Data are bound by confidentiality;</li>
        <li>Implement appropriate technical and organizational security measures;</li>
        <li>Assist the Controller in responding to Data Subject requests;</li>
        <li>Notify the Controller without undue delay of any Personal Data Breach;</li>
        <li>Delete or return Personal Data upon termination of the Service;</li>
        <li>Make available all information necessary to demonstrate compliance.</li>
      </ul>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        4. Sub-processors
      </h2>
      <p>
        The Controller authorizes Employee to engage sub-processors. A current
        list is available on our{" "}
        <a
          className="text-foreground underline underline-offset-4"
          href="/sub-processors"
        >
          Sub-processors
        </a>{" "}
        page. Employee will inform the Controller of any intended changes and give
        the opportunity to object.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        5. International Transfers
      </h2>
      <p>
        Where Personal Data is transferred outside the EEA, Employee ensures
        appropriate safeguards, including Standard Contractual Clauses approved
        by the European Commission.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        6. Security Measures
      </h2>
      <p>
        Employee implements measures including: encryption in transit and at rest,
        access controls, audit logging, regular security reviews, and
        incident response procedures.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        7. Audit Rights
      </h2>
      <p>
        The Controller may audit Employee's compliance with this DPA, subject to
        reasonable notice and confidentiality obligations.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        8. Liability
      </h2>
      <p>
        Each party's liability under this DPA is subject to the limitations set
        forth in the Terms of Service.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        9. Term and Termination
      </h2>
      <p>
        This DPA remains in effect for as long as Employee processes Personal Data
        on behalf of the Controller.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        10. Contact
      </h2>
      <p>
        To execute a signed DPA or for any questions, contact us at{" "}
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
