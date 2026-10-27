// app/(legal)/sub-processors/page.tsx
export const metadata = {
  title: "Sub-processors — Employee",
};

const subProcessors = [
  {
    name: "Vercel",
    purpose: "Hosting and edge network",
    location: "United States",
    url: "https://vercel.com/legal/privacy-policy",
  },
  {
    name: "Neon",
    purpose: "Serverless Postgres database",
    location: "United States",
    url: "https://neon.tech/privacy-policy",
  },
  {
    name: "Stripe",
    purpose: "Payment processing",
    location: "United States",
    url: "https://stripe.com/privacy",
  },
  {
    name: "OpenAI",
    purpose: "AI model provider",
    location: "United States",
    url: "https://openai.com/policies/privacy-policy",
  },
  {
    name: "Anthropic",
    purpose: "AI model provider",
    location: "United States",
    url: "https://www.anthropic.com/legal/privacy",
  },
  {
    name: "Vercel Blob",
    purpose: "File storage",
    location: "United States",
    url: "https://vercel.com/legal/privacy-policy",
  },
  {
    name: "Upstash Redis",
    purpose: "Rate limiting and caching",
    location: "United States",
    url: "https://upstash.com/trust/privacy.pdf",
  },
];

export default function SubProcessorsPage() {
  return (
    <article className="max-w-none">
      <h1 className="text-[28px] font-medium tracking-tight">
        Sub-processors
      </h1>

      <p className="mt-3 text-[13px] text-muted-foreground">
        Last updated: January 1, 2026
      </p>

      <p className="mt-8 text-[14px] leading-relaxed">
        Employee uses the following sub-processors to provide the Service. Each
        sub-processor is bound by a data processing agreement and appropriate
        security obligations.
      </p>

      <div className="mt-8 overflow-hidden rounded-xl border border-border/60">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-4 py-3 font-medium text-foreground">Name</th>
              <th className="px-4 py-3 font-medium text-foreground">Purpose</th>
              <th className="px-4 py-3 font-medium text-foreground">Location</th>
            </tr>
          </thead>
          <tbody>
            {subProcessors.map((sp) => (
              <tr className="border-t border-border/40" key={sp.name}>
                <td className="px-4 py-3">
                  <a
                    className="text-foreground underline underline-offset-4"
                    href={sp.url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {sp.name}
                  </a>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {sp.purpose}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {sp.location}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-8 text-[13px] leading-relaxed text-muted-foreground">
        We will notify customers of any changes to this list at least 30 days
        in advance. To receive notifications, contact{" "}
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
