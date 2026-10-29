// app/(auth)/register/page.tsx
"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef, useState } from "react";

import { AuthForm } from "@/components/workspace/auth-form";
import { SubmitButton } from "@/components/workspace/submit-button";
import { type RegisterActionState, register } from "../actions";

export default function Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/workspace";
  const t = useTranslations("auth");
  const tErr = useTranslations("auth.errors");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSuccessful, setIsSuccessful] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const processedRef = useRef<string | null>(null);

  const [state, formAction] = useActionState<RegisterActionState, FormData>(
    register,
    { status: "idle" }
  );

  useEffect(() => {
    if (state.status === "idle" || state.status === "in_progress") {
      return;
    }

    const stateKey = `${state.status}-${state.errorCode ?? ""}`;
    if (processedRef.current === stateKey) {
      return;
    }
    processedRef.current = stateKey;

    if (state.status === "error" && state.errorCode) {
      setInlineError(tErr(state.errorCode));
      setIsSuccessful(false);
      return;
    }

    if (state.status === "success") {
      setIsSuccessful(true);
      setInlineError(null);

      signIn("credentials", {
        email,
        password,
        redirect: false,
      })
        .then((result) => {
          if (result?.error) {
            setInlineError(tErr("server_error"));
            setIsSuccessful(false);
          } else {
            setEmail("");
            setPassword("");
            setIsRedirecting(true);
            router.push(callbackUrl);
            router.refresh();
          }
        })
        .catch(() => {
          setInlineError(tErr("network_error"));
          setIsSuccessful(false);
        });
    }
  }, [state, email, password, router, callbackUrl, tErr]);

  const handleSubmit = (formData: FormData) => {
    setEmail(formData.get("email") as string);
    setPassword(formData.get("password") as string);
    setInlineError(null);
    processedRef.current = null;
    formAction(formData);
  };

  if (isRedirecting) {
    return (
      <div className="flex min-h-[400px] w-full flex-col items-center justify-center gap-4">
        <div className="size-6 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-foreground" />
        <p className="text-[13px] text-muted-foreground">{t("pleaseWait")}</p>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col">
      {/* WELCOME */}
      <div className="text-center">
        <p className="mx-auto max-w-[380px] text-[16px] leading-[1.6] text-muted-foreground">
          {t("createAccount")}
          <br className="hidden sm:block" />
          {t("createAccountLine")}
        </p>
      </div>

      {/* OAUTH */}
      <div className="mt-8 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => signIn("github", { callbackUrl })}
          className="
            flex h-11 w-full items-center justify-center gap-2.5
            rounded-lg border border-border bg-muted/60
            text-[13px] font-medium text-foreground
            transition-colors duration-150
            hover:bg-muted
          "
        >
          <svg className="size-[16px]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
          {t("continueWithGithub")}
        </button>

        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl })}
          className="
            flex h-11 w-full items-center justify-center gap-2.5
            rounded-lg border border-border bg-muted/60
            text-[13px] font-medium text-foreground
            transition-colors duration-150
            hover:bg-muted
          "
        >
          <svg className="size-[16px]" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          {t("continueWithGoogle")}
        </button>
      </div>

      {/* DIVIDER */}
      <div className="my-7 flex items-center gap-3">
        <div className="h-px flex-1 bg-border/50" />
        <span className="shrink-0 text-[11px] text-muted-foreground/70">
          {t("orByEmail")}
        </span>
        <div className="h-px flex-1 bg-border/50" />
      </div>

      {/* INLINE ERROR */}
      {inlineError && (
        <div className="mb-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-[12px] text-destructive">
          {inlineError}
        </div>
      )}

      {/* FORM */}
      <AuthForm action={handleSubmit} defaultEmail={email}>
        <SubmitButton isSuccessful={isSuccessful}>
          {t("signUpButton")}
        </SubmitButton>

        <p className="mt-7 text-center text-[12.5px] text-muted-foreground">
          {t("haveAccount")}{" "}
          <Link
            href="/login"
            className="font-medium text-foreground transition-colors hover:text-foreground/70"
          >
            {t("signIn")}
          </Link>
        </p>
      </AuthForm>
    </div>
  );
}
