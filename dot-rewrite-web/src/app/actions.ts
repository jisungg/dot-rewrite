"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { type User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";

export type ActionResult = { error?: string; success?: string };

async function checkEmailExists(email: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_email_exists", {
    email_input: email,
  });

  if (error) {
    console.error("check_email_exists RPC:", error.message);
    return false;
  }
  return Boolean(data);
}

async function originFromHeaders(): Promise<string | null> {
  return (await headers()).get("origin");
}

export async function encodedRedirect(
  type: "error" | "success",
  path: string,
  message: string,
): Promise<never> {
  redirect(`${path}?${type}=${encodeURIComponent(message)}`);
}

export async function signUpAction(formData: {
  name: string;
  email: string;
  password: string;
}): Promise<ActionResult> {
  const { name, email, password } = formData;

  if (await checkEmailExists(email)) {
    return { error: "This email is already in use." };
  }

  const supabase = await createClient();
  const origin = await originFromHeaders();

  const fullName = name.trim().replace(/\s+/g, " ").split(" ");

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: {
        first_name: fullName[0] ?? "",
        last_name: fullName[1] ?? "",
      },
    },
  });

  if (error) {
    console.error(`${error.code ?? "unknown"}: ${error.message}`);
    return { error: error.message };
  }

  return {
    success:
      "We've sent you a link to your email! You must verify your email before logging in.",
  };
}

export async function signInAction(formData: {
  email: string;
  password: string;
}): Promise<ActionResult> {
  const { email, password } = formData;

  if (!(await checkEmailExists(email))) {
    return {
      error:
        "We couldn't find an account associated with that email address. Please double-check for any typos.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.message === "Email not confirmed") {
      return { error: "Please confirm your email address." };
    }
    return { error: error.message };
  }

  redirect("/dashboard");
}

export async function forgotPasswordAction(formData: {
  email: string;
}): Promise<ActionResult> {
  const { email } = formData;

  if (!email || !(await checkEmailExists(email))) {
    return {
      error:
        "We couldn't find an account associated with that email address.",
    };
  }

  const supabase = await createClient();
  const origin = await originFromHeaders();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?redirect_to=/dashboard/reset-password`,
  });

  if (error) {
    console.error(error.message);
    return { error: error.message };
  }

  return { success: "We've sent a link to your email address." };
}

export async function resetPasswordAction(formData: FormData): Promise<void> {
  const supabase = await createClient();

  const password = formData.get("password")?.toString() ?? "";
  const confirmPassword = formData.get("confirmPassword")?.toString() ?? "";

  if (!password || !confirmPassword) {
    return encodedRedirect(
      "error",
      "/dashboard/reset-password",
      "Password and confirm password are required",
    );
  }

  if (password !== confirmPassword) {
    return encodedRedirect(
      "error",
      "/dashboard/reset-password",
      "Passwords do not match",
    );
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return encodedRedirect(
      "error",
      "/dashboard/reset-password",
      "Password update failed",
    );
  }

  return encodedRedirect(
    "success",
    "/dashboard/reset-password",
    "Password updated",
  );
}

export async function signOutAction(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function getUser(): Promise<User> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    redirect("/sign-in");
  }
  return user;
}
