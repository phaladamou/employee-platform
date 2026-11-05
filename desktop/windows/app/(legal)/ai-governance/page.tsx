// app/(legal)/ai-governance/page.tsx
export const metadata = {
  title: "AI Governance — Employee",
};

export default function AiGovernancePage() {
  return (
    <article className="prose prose-neutral dark:prose-invert max-w-none">
      <h1 className="text-[28px] font-medium tracking-tight">AI Governance</h1>

      <p className="mt-3 text-[13px] text-muted-foreground">
        Last updated: November 3, 2026
      </p>

      <p className="mt-8">
        Employee gives AI employees real agency: they run missions, use tools,
        and act inside connected services. This page explains the controls
        that keep that agency safe, scoped, and accountable.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        1. Least Privilege by Design
      </h2>
      <p>
        Every AI employee operates under a versioned profile that declares
        exactly which tools it may use. An employee without a permission
        cannot use the corresponding tool — the runtime refuses before any
        model call is made. Permissions are bound at hire time and can only
        change through an explicit migration, never silently.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        2. Human Approval &amp; Oversight
      </h2>
      <p>
        Sensitive tool uses require the employer&apos;s explicit approval
        before they run. Missions declare acceptance criteria up front, and
        results are verified against them — including checks on the files and
        artifacts actually produced.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        3. Verifiable Outcomes
      </h2>
      <p>
        A mission never succeeds on the AI&apos;s word alone. Completed work
        carries a signed, verifiable proof; anything that cannot be verified
        — unverified claims, blocked actions, or honest refusals — is flagged
        for human review instead of being reported as done. Employers always
        see the full record of what was attempted, not just the summary.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        4. Isolation
      </h2>
      <p>
        Employees, missions, and memory are strictly scoped to the employer
        that owns them. Each employee works inside its own workspace, and
        shell execution on our backend runs under filesystem confinement with
        time and output limits. See our{" "}
        <a
          className="text-foreground underline underline-offset-4"
          href="/security"
        >
          Security
        </a>{" "}
        page for details.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        5. Models &amp; Your Data
      </h2>
      <p>
        AI employees are powered by third-party large language models (see
        our{" "}
        <a
          className="text-foreground underline underline-offset-4"
          href="/sub-processors"
        >
          Sub-processors
        </a>{" "}
        page). Your content is processed to run your missions — it is not used
        to train models. Only the data needed for the current mission is sent
        to the model provider.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        6. Incident Handling
      </h2>
      <p>
        If an AI employee behaves unexpectedly — acting outside its mission,
        producing harmful content, or accessing data it should not — terminate
        the mission and report it to{" "}
        <a
          className="text-foreground underline underline-offset-4"
          href="mailto:security@employee.app"
        >
          security@employee.app
        </a>
        . We investigate every report and use it to strengthen our controls.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        7. Acceptable Use
      </h2>
      <p>
        Employers are responsible for the missions they assign. Using AI
        employees to harm others, attack third-party systems, or circumvent
        safety controls violates our{" "}
        <a
          className="text-foreground underline underline-offset-4"
          href="/acceptable-use"
        >
          Acceptable Use Policy
        </a>{" "}
        and may result in suspension of your account.
      </p>
    </article>
  );
}
