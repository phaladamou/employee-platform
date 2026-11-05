// app/(legal)/retention/page.tsx
export const metadata = {
  title: "Data Retention & Deletion — Employee",
};

const retentionTable = [
  {
    category: "Account data",
    details: "Profile, email address, onboarding information.",
    retention: "Kept while your account is active.",
  },
  {
    category: "Employees & missions",
    details: "Hired employees, mission history, reports, and proofs.",
    retention: "Kept while your account is active.",
  },
  {
    category: "Connected-service credentials",
    details: "Encrypted access tokens acting on your behalf.",
    retention: "Deleted when you disconnect the service or delete your account.",
  },
  {
    category: "Chat history",
    details: "Conversations with your Manager and employees.",
    retention: "Kept while your account is active; delete any conversation at any time.",
  },
  {
    category: "Operational logs",
    details: "Authentication events and error diagnostics.",
    retention: "Short-lived, kept only as long as needed for security and debugging.",
  },
  {
    category: "Backups",
    details: "Rolling infrastructure backups.",
    retention: "Expire on a rolling basis after source data is deleted.",
  },
];

export default function RetentionPage() {
  return (
    <article className="max-w-none">
      <h1 className="text-[28px] font-medium tracking-tight">
        Data Retention &amp; Deletion
      </h1>

      <p className="mt-3 text-[13px] text-muted-foreground">
        Last updated: November 3, 2026
      </p>

      <p className="mt-8 text-[14px] leading-relaxed">
        We keep your data only for as long as it is needed to provide the
        Service, as described in our{" "}
        <a
          className="text-foreground underline underline-offset-4"
          href="/privacy"
        >
          Privacy Policy
        </a>
        . This page details what we keep, for how long, and how to delete it.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        1. What We Keep
      </h2>
      <div className="mt-6 overflow-hidden rounded-xl border border-border/60">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-4 py-3 font-medium text-foreground">Category</th>
              <th className="px-4 py-3 font-medium text-foreground">
                Retention
              </th>
            </tr>
          </thead>
          <tbody>
            {retentionTable.map((row) => (
              <tr className="border-t border-border/40" key={row.category}>
                <td className="px-4 py-3">
                  <span className="font-medium">{row.category}</span>
                  <span className="mt-0.5 block text-muted-foreground">
                    {row.details}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {row.retention}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        2. Deleting Your Data
      </h2>
      <p className="mt-4 text-[14px] leading-relaxed">
        You can delete individual conversations and disconnect third-party
        services at any time. Deleting your account removes your personal
        information from our systems within 30 days, except where we are
        required to retain it by law (for example for invoicing records).
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        3. Export &amp; Requests
      </h2>
      <p className="mt-4 text-[14px] leading-relaxed">
        To export your data or request deletion of specific information,
        contact us at{" "}
        <a
          className="text-foreground underline underline-offset-4"
          href="mailto:privacy@employee.app"
        >
          privacy@employee.app
        </a>{" "}
        from the email address linked to your account. Business customers with
        a signed{" "}
        <a className="text-foreground underline underline-offset-4" href="/dpa">
          Data Processing Agreement
        </a>{" "}
        are covered by its deletion and return terms.
      </p>
    </article>
  );
}
