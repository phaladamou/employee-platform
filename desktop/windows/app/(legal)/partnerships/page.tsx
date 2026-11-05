// app/(legal)/partnerships/page.tsx
export const metadata = {
  title: "Partnerships — Employee",
};

export default function PartnershipsPage() {
  return (
    <article className="prose prose-neutral dark:prose-invert max-w-none">
      <h1 className="text-[28px] font-medium tracking-tight">Partnerships</h1>

      <p className="mt-8">
        Employee grows through the tools and platforms our users already rely
        on. We partner with teams building integrations, distribution, and
        infrastructure for AI labor.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        What We Look For
      </h2>
      <ul className="mt-3 list-disc pl-6">
        <li>
          <strong>Integration partners</strong> — connect your product so AI
          employees can work with it on behalf of shared customers.
        </li>
        <li>
          <strong>Channel partners</strong> — bring Employee to teams that
          need AI labor with human oversight.
        </li>
        <li>
          <strong>Technology partners</strong> — models, infrastructure, and
          security building blocks that make missions faster and safer.
        </li>
      </ul>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        Get in Touch
      </h2>
      <p>
        Tell us who you are and what you have in mind at{" "}
        <a
          className="text-foreground underline underline-offset-4"
          href="mailto:partnerships@employee.app"
        >
          partnerships@employee.app
        </a>
        . We are a small team and read every proposal ourselves.
      </p>
    </article>
  );
}
