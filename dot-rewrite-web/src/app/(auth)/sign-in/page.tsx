"use client";

import Link from "next/link";
import { Lock, Mail } from "lucide-react";
import { AuthForm, type FormField } from "@/components/auth/auth-form";
import { AuthLayout } from "@/components/auth/auth-layout";
import { signInAction } from "@/app/actions";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const fields: FormField[] = [
  {
    id: "email",
    label: "Email Address",
    type: "email",
    placeholder: "john@company.com",
    icon: <Mail className="h-4 w-4" />,
    required: true,
    validation: (v) =>
      emailRegex.test(v) ? null : "Please enter a valid email address",
  },
  {
    id: "password",
    label: "Password",
    type: "password",
    placeholder: "Enter your password",
    icon: <Lock className="h-4 w-4" />,
    required: true,
  },
];

export default function SignInPage() {
  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your account to continue"
    >
      <AuthForm
        fields={fields}
        submitText="Sign In"
        submitFunction={async (data) =>
          signInAction({ email: data["email"], password: data["password"] })
        }
        footerText={
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="remember"
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label
                  htmlFor="remember"
                  className="text-sm text-gray-600 dark:text-gray-400"
                >
                  Remember me
                </label>
              </div>
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-blue-600 hover:text-blue-500"
              >
                Forgot password?
              </Link>
            </div>
            Don&apos;t have an account?{" "}
            <Link
              href="/sign-up"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              Sign up
            </Link>
          </>
        }
      />
    </AuthLayout>
  );
}
