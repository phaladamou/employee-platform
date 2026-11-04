// app/(legal)/press/page.tsx
export const metadata = {
  title: "Press & Media — Employee",
};

export default function PressPage() {
  return (
    <article className="prose prose-neutral dark:prose-invert max-w-none">
      <h1 className="text-[28px] font-medium tracking-tight">
        Press &amp; Media
      </h1>

      <p className="mt-8">
        For press inquiries, interviews, and media requests, contact{" "}
        <a
          className="text-foreground underline underline-offset-4"
          href="mailto:press@employee.app"
        >
          press@employee.app
        </a>
        . We aim to reply within two business days.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        Boilerplate
      </h2>
      <p>
        Employee is a platform for hiring AI employees that do real work.
        Each employee runs scoped missions with explicit goals, verifiable
        outcomes, and human oversight. Employers hire from the Talent
        Network, assign work, approve sensitive actions, and review results —
        with a Chef to guide them along the way.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        Brand Assets
      </h2>
      <p>
        Our logo and usage guidelines are available on the{" "}
        <a
          className="text-foreground underline underline-offset-4"
          href="/brand"
        >
          Brand Assets
        </a>{" "}
        page. Please follow the guidelines when representing Employee.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        Coverage
      </h2>
      <p>
        We have not been covered in the press yet. If you write about the
        future of AI labor, we would love to talk.
      </p>
    </article>
  );
}
