// app/(auth)/register/page.tsx
import { redirect } from "next/navigation";

// Plus d'inscription par mot de passe : le compte est cree au premier
// code OTP recu, via /login. Cette route ne fait que rediriger.
export default function Page() {
  redirect("/login");
}
