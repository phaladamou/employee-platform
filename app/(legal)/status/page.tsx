// app/(legal)/status/page.tsx
export const metadata = {
  title: "Status — Employee",
};

export default function StatusPage() {
  return (
    <article className="max-w-none">
      <h1 className="text-[28px] font-medium tracking-tight">Status</h1>

      <p className="mt-3 text-[13px] text-muted-foreground">
        Last updated: November 3, 2026
      </p>

      <div className="mt-8 flex items-center gap-3 rounded-xl border border-border/60 px-5 py-4">
        <span
          aria-hidden="true"
          className="inline-block size-2.5 rounded-full bg-emerald-500"
        />
        <p className="text-[14px] font-medium">
          All systems operational — no known incidents.
        </p>
      </div>

      <p className="mt-8 text-[14px] leading-relaxed">
        We do not run a separate automated status page yet — this page is
        updated manually when an incident affects the Service. If something
        looks wrong on your side, check the following before reporting:
      </p>
      <ul className="mt-4 list-disc pl-6 text-[14px] leading-relaxed">
        <li>Refresh the app and check your network connection;</li>
        <li>
          Make sure you are signed in — an expired session can look like an
          outage;
        </li>
        <li>Try the desktop app if the web app fails, or vice versa.</li>
      </ul>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        Report a Problem
      </h2>
      <p className="mt-4 text-[14px] leading-relaxed">
        Still stuck? Email{" "}
        <a
          className="text-foreground underline underline-offset-4"
          href="mailto:support@employee.app"
        >
          support@employee.app
        </a>{" "}
        with what you were doing, what you expected, and what happened
        instead. Screenshots and the time of the incident help us
        investigate faster.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        Incident History
      </h2>
      <p className="mt-4 text-[14px] leading-relaxed text-muted-foreground">
        No incidents have been recorded here yet.
      </p>
    </article>
  );
}
