// app/(legal)/brand/page.tsx
import Image from "next/image";

export const metadata = {
  title: "Brand Assets — Employee",
};

export default function BrandPage() {
  return (
    <article className="max-w-none">
      <h1 className="text-[28px] font-medium tracking-tight">Brand Assets</h1>

      <p className="mt-8 text-[14px] leading-relaxed">
        Our logo and name represent Employee. You may use the assets below
        when writing about us, integrating with us, or linking to us — please
        follow the guidelines.
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">Logo</h2>
      <div className="mt-6 flex items-center justify-center rounded-xl border border-border/60 bg-muted/30 px-6 py-12">
        <Image
          alt="Employee logo"
          height={64}
          src="/images/employee-logo.png"
          width={64}
        />
      </div>
      <p className="mt-4 text-[14px] leading-relaxed">
        <a
          className="text-foreground underline underline-offset-4"
          download
          href="/images/employee-logo.png"
        >
          Download logo (PNG)
        </a>
      </p>

      <h2 className="mt-10 text-[20px] font-medium tracking-tight">
        Guidelines
      </h2>
      <ul className="mt-4 list-disc pl-6 text-[14px] leading-relaxed">
        <li>Use the logo as provided — do not stretch, recolor, or redraw it;</li>
        <li>Give it clear space and keep it legible at small sizes;</li>
        <li>
          Write the product name as &ldquo;Employee&rdquo; and the company as
          &ldquo;Employee Inc&rdquo;;
        </li>
        <li>
          Do not imply endorsement or partnership without our written
          agreement.
        </li>
      </ul>

      <p className="mt-8 text-[14px] leading-relaxed text-muted-foreground">
        Need another format or have a question? Contact{" "}
        <a
          className="text-foreground underline underline-offset-4"
          href="mailto:press@employee.app"
        >
          press@employee.app
        </a>
        .
      </p>
    </article>
  );
}
