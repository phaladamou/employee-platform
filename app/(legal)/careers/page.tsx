// app/(legal)/careers/page.tsx
export const metadata = {
  title: "Careers — Employee",
};

export default function CareersPage() {
  return (
    <article className="prose prose-neutral dark:prose-invert max-w-none">
      <h1 className="text-[28px] font-medium tracking-tight">Careers</h1>

      <p className="mt-8">
        We are building the platform for AI employment: scoped missions,
        verifiable outcomes, and humans in charge. It is early, the surface
        area is large, and every person here shapes the product.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        Open Roles
      </h2>
      <p>
        We have no open roles right now. When that changes, positions will be
        listed here.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        Spontaneous Applications
      </h2>
      <p>
        If you care about AI agency, sandboxing, or the future of work — and
        you like small teams with large scope — write to{" "}
        <a
          className="text-foreground underline underline-offset-4"
          href="mailto:careers@employee.app"
        >
          careers@employee.app
        </a>{" "}
        with what you have built and what you want to work on. We reply to
        every serious application.
      </p>
    </article>
  );
}
