// app/(auth)/actions.ts
"use server";

import { compare } from "bcrypt-ts";
import { z } from "zod";

import { createUser, getUser } from "@/lib/db/queries";

const authFormSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export type LoginErrorCode =
  | "invalid_email"
  | "password_too_short"
  | "user_not_found"
  | "no_password"
  | "wrong_password"
  | "server_error";

export type LoginActionState = {
  status: "idle" | "in_progress" | "success" | "error";
  errorCode?: LoginErrorCode;
};

export const login = async (
  _: LoginActionState,
  formData: FormData
): Promise<LoginActionState> => {
  try {
    const emailRaw = formData.get("email");
    const passwordRaw = formData.get("password");

    // Validation email
    const emailCheck = z.string().email().safeParse(emailRaw);
    if (!emailCheck.success) {
      return { status: "error", errorCode: "invalid_email" };
    }

    // Validation password
    const passwordCheck = z.string().min(6).safeParse(passwordRaw);
    if (!passwordCheck.success) {
      return { status: "error", errorCode: "password_too_short" };
    }

    const email = emailCheck.data;
    const password = passwordCheck.data;

    const [user] = await getUser(email);

    if (!user) {
      return { status: "error", errorCode: "user_not_found" };
    }

    if (!user.password) {
      return { status: "error", errorCode: "no_password" };
    }

    const passwordMatch = await compare(password, user.password);

    if (!passwordMatch) {
      return { status: "error", errorCode: "wrong_password" };
    }

    return { status: "success" };
  } catch (error) {
    console.error("[LOGIN] server error:", error);
    return { status: "error", errorCode: "server_error" };
  }
};

export type RegisterErrorCode =
  | "invalid_email"
  | "password_too_short"
  | "user_exists"
  | "server_error";

export type RegisterActionState = {
  status: "idle" | "in_progress" | "success" | "error";
  errorCode?: RegisterErrorCode;
};

export const register = async (
  _: RegisterActionState,
  formData: FormData
): Promise<RegisterActionState> => {
  try {
    const emailRaw = formData.get("email");
    const passwordRaw = formData.get("password");

    const emailCheck = z.string().email().safeParse(emailRaw);
    if (!emailCheck.success) {
      return { status: "error", errorCode: "invalid_email" };
    }

    const passwordCheck = z.string().min(6).safeParse(passwordRaw);
    if (!passwordCheck.success) {
      return { status: "error", errorCode: "password_too_short" };
    }

    const email = emailCheck.data;
    const password = passwordCheck.data;

    const [user] = await getUser(email);

    if (user) {
      return { status: "error", errorCode: "user_exists" };
    }

    await createUser(email, password);

    return { status: "success" };
  } catch (error) {
    console.error("[REGISTER] server error:", error);
    return { status: "error", errorCode: "server_error" };
  }
};
