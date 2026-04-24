"use client";

import Link from "next/link";
import { Lock, Mail, User } from "lucide-react";
import { AuthForm, type FormField } from "@/components/auth/auth-form";
import { AuthLayout } from "@/components/auth/auth-layout";
import { signUpAction } from "@/app/actions";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const fullNameRegex = /^[A-Za-z]+(?: [A-Za-z]+)+$/;

const validatePassword = (password: string) => {
  if (password.length < 7) return "Password must be at least 7 characters";
  if (!/[A-Z]/.test(password))
    return "Password must contain at least 1 uppercase letter";
  if (!/\d/.test(password)) return "Password must contain at least 1 number";
  return null;
};

const validateEmail = (email: string) =>
  emailRegex.test(email) ? null : "Please enter a valid email address";

const validateName = (name: string) => {
  const normalized = name.trim().replace(/\s+/g, " ");
  if (!normalized) return "Full name cannot be empty.";
  if (!fullNameRegex.test(normalized))
    return "Enter first and last name (i.e. John Doe).";
  return null;
};

const fields: FormField[] = [
  {
    id: "name",
    label: "Full Name",
    type: "text",
    placeholder: "John Doe",
    icon: <User className="h-4 w-4" />,
    required: true,
    validation: validateName,
  },
  {
    id: "email",
    label: "Email Address",
    type: "email",
    placeholder: "john@company.com",
    icon: <Mail className="h-4 w-4" />,
    required: true,
    validation: validateEmail,
  },
  {
    id: "password",
    label: "Password",
    type: "password",
    placeholder: "Create a secure password",
    icon: <Lock className="h-4 w-4" />,
    required: true,
    validation: validatePassword,
  },
];

export default function SignUpPage() {
  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start your 14-day free trial. No credit card required."
    >
      <AuthForm
        fields={fields}
        submitText="Create Account"
        submitFunction={async (data) =>
          signUpAction({
            name: data["name"],
            email: data["email"],
            password: data["password"],
          })
        }
        footerText={
          <>
            Already have an account?{" "}
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
