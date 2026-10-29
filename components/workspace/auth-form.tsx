import Form from "next/form";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Input } from "../ui/input";

export function AuthForm({
  action,
  children,
  defaultEmail = "",
}: {
  action: NonNullable<
    string | ((formData: FormData) => void | Promise<void>) | undefined
  >;
  children: React.ReactNode;
  defaultEmail?: string;
}) {
  const t = useTranslations("auth");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");

  return (
    <Form action={action} className="flex flex-col gap-2">
      {/* EMAIL */}
      <div className="relative">
        <Mail
          className="pointer-events-none absolute left-3.5 top-1/2 z-10 size-[16px] -translate-y-1/2 text-muted-foreground/60"
          strokeWidth={1.6}
        />

        <Input
          autoComplete="email"
          autoFocus
          id="email"
          name="email"
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("emailPlaceholder")}
          required
          type="email"
          value={email}
          className="
            h-11 rounded-lg border border-input bg-muted/60
            pl-11 pr-4 text-[13px] text-foreground
            shadow-none outline-none
            placeholder:text-muted-foreground/60
            transition-colors
            focus-visible:border-ring focus-visible:bg-muted
            focus-visible:ring-0
          "
        />
      </div>

      {/* PASSWORD */}
      <div className="relative">
        <LockKeyhole
          className="pointer-events-none absolute left-3.5 top-1/2 z-10 size-[16px] -translate-y-1/2 text-muted-foreground/60"
          strokeWidth={1.6}
        />

        <Input
          autoComplete="current-password"
          id="password"
          name="password"
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("passwordPlaceholder")}
          required
          type={showPassword ? "text" : "password"}
          value={password}
          className="
            h-11 rounded-lg border border-input bg-muted/60
            pl-11 pr-11 text-[13px] text-foreground
            shadow-none outline-none
            placeholder:text-muted-foreground/60
            transition-colors
            focus-visible:border-ring focus-visible:bg-muted
            focus-visible:ring-0
          "
        />

        <button
          type="button"
          aria-label={showPassword ? t("hidePassword") : t("showPassword")}
          onClick={() => setShowPassword((value) => !value)}
          className="absolute right-3.5 top-1/2 z-10 -translate-y-1/2 text-muted-foreground/60 transition-colors hover:text-foreground"
        >
          {showPassword ? (
            <EyeOff className="size-[16px]" strokeWidth={1.6} />
          ) : (
            <Eye className="size-[16px]" strokeWidth={1.6} />
          )}
        </button>
      </div>

      {children}
    </Form>
  );
}
