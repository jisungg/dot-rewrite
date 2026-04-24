"use client";

import Link from "next/link";
import { Mail } from "lucide-react";
import { AuthForm, type FormField } from "@/components/auth/auth-form";
import { AuthLayout } from "@/components/auth/auth-layout";
import { forgotPasswordAction } from "@/app/actions";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const fields: FormField[] = [
  {
    id: "email",
    label: "Email Address",
    type: "email",
    placeholder: "Enter your email address",
    icon: <Mail className="h-4 w-4" />,
    required: true,
    validation: (v) =>
      emailRegex.test(v) ? null : "Please enter a valid email address",
  },
];

export default function ForgotPasswordPage() {
  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We'll send you a link to reset your password"
    >
      <AuthForm
        fields={fields}
        submitText="Send Reset Link"
        submitFunction={async (data) =>
          forgotPasswordAction({ email: data["email"] })
        }
        footerText={
          <>
            Remember your password?{" "}
            <Link
              href="/sign-in"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              Sign in
            </Link>
          </>
        }
      />
    </AuthLayout>
  );
}
