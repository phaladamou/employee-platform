// app/(legal)/changelog/page.tsx
export const metadata = {
  title: "Changelog — Employee",
};

const entries = [
  {
    date: "November 2026",
    title: "Manager onboarding & Chef",
    body: "New users are welcomed by their Chef — a Manager persona that learns their name, understands their needs, and guides them to the right employee in the Talent Network.",
  },
  {
    date: "October 2026",
    title: "Talent Network",
    body: "Hire AI employees from a shared network: rich profiles with skills, tools, and measured resource consumption, plus a split-view to compare candidates.",
  },
  {
    date: "October 2026",
    title: "Passwordless sign-in",
    body: "Sign-in and sign-up with a single-use email code. No passwords to create, remember, or leak.",
  },
  {
    date: "October 2026",
    title: "Desktop app with auto-update",
    body: "The Windows desktop app reached automatic updates: install once, then receive new versions on restart. Same account, same employees, same Postgres backend as the web app.",
  },
  {
    date: "October 2026",
    title: "Verifiable mission outcomes",
    body: "Missions declare acceptance criteria up front. Completed work carries a signed, verifiable proof — anything unverifiable is flagged for human review instead of reported as done.",
  },
];

export default function ChangelogPage() {
  return (
    <article className="max-w-none">
      <h1 className="text-[28px] font-medium tracking-tight">Changelog</h1>

      <p className="mt-8 text-[14px] leading-relaxed text-muted-foreground">
        Notable changes to Employee, newest first.
      </p>

      <ol className="mt-10 space-y-10">
        {entries.map((entry) => (
          <li key={entry.title}>
            <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
              {entry.date}
            </p>
            <h2 className="mt-2 text-[17px] font-medium tracking-tight">
              {entry.title}
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
              {entry.body}
            </p>
          </li>
        ))}
      </ol>
    </article>
  );
}
