"use client";

import { type ReactNode, useEffect, useState } from "react";
import { AlertCircle, Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type ActionResult } from "@/app/actions";

export type FormField = {
  id: string;
  label: string;
  type: string;
  placeholder: string;
  icon: ReactNode;
  required?: boolean;
  validation?: (value: string) => string | null;
};

type SubmitFn = (data: Record<string, string>) => Promise<ActionResult | void>;

type AuthFormProps = {
  fields: FormField[];
  submitText: string;
  footerText?: ReactNode;
  submitFunction?: SubmitFn;
  onError?: (errorMessage: string | null) => void;
};

export function AuthForm({
  fields,
  submitText,
  footerText,
  submitFunction,
  onError,
}: AuthFormProps) {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setFormData(
      fields.reduce<Record<string, string>>((acc, f) => {
        acc[f.id] = "";
        return acc;
      }, {}),
    );
  }, [fields]);

  const validateField = (id: string, value: string) => {
    const field = fields.find((f) => f.id === id);
    if (!field) return null;
    if (field.required && !value.trim()) return `${field.label} is required`;
    return field.validation ? field.validation(value) : null;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));

    if (touched[id]) {
      const error = validateField(id, value);
      setErrors((prev) => ({ ...prev, [id]: error ?? "" }));
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setTouched((prev) => ({ ...prev, [id]: true }));
    const error = validateField(id, value);
    setErrors((prev) => ({ ...prev, [id]: error ?? "" }));
  };

  const validateForm = () => {
    const next: Record<string, string> = {};
    let valid = true;

    for (const field of fields) {
      const err = validateField(field.id, formData[field.id] ?? "");
      if (err) {
        next[field.id] = err;
        valid = false;
      }
    }

    setErrors(next);
    return valid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const allTouched = fields.reduce<Record<string, boolean>>((acc, f) => {
      acc[f.id] = true;
      return acc;
    }, {});
    setTouched(allTouched);

    if (!validateForm()) return;

    setIsSubmitting(true);
    setFormError("");
    setSuccess("");
    onError?.(null);

    try {
      const response = await submitFunction?.(formData);
      if (response?.error) {
        setFormError(response.error);
        onError?.(response.error);
      } else if (response?.success) {
        setSuccess(response.success);
        onError?.(null);
      }
    } catch {
      const message = "Something went wrong. Please try again.";
      setFormError(message);
      onError?.(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-6 fade-in-fast">
      {fields.map((field) => (
        <div key={field.id} className="space-y-2">
          <Label
            htmlFor={field.id}
            className="text-sm font-medium flex justify-between"
            style={{ color: "#334155" }}
          >
            <span>
              {field.label}{" "}
              {field.required && (
                <span style={{ color: "#ef4444" }}>*</span>
              )}
            </span>
            {errors[field.id] && touched[field.id] && (
              <span
                className="text-xs flex items-center fade-in-fast"
                style={{ color: "#ef4444" }}
              >
                <X className="h-3 w-3 mr-1" />
                {errors[field.id]}
              </span>
            )}
          </Label>
          <div className="relative">
            <div
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: "#3b82f6" }}
            >
              {field.icon}
            </div>
            <Input
              id={field.id}
              type={field.type}
              placeholder={field.placeholder}
              className={`pl-10 rounded-lg ${
                errors[field.id] && touched[field.id]
                  ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                  : "border-slate-200 focus:border-blue-500 focus:ring-blue-500"
              }`}
              value={formData[field.id] ?? ""}
              onChange={handleChange}
              onBlur={handleBlur}
            />
          </div>
        </div>
      ))}

      {formError && (
        <div
          className="p-3 rounded-lg flex items-center gap-2 text-sm fade-in-fast"
          style={{ backgroundColor: "#fef2f2", color: "#dc2626" }}
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{formError}</span>
          <button
            type="button"
            className="ml-auto"
            style={{ color: "#f87171" }}
            onClick={() => setFormError("")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {success && (
        <div
          className="p-3 rounded-lg flex items-center gap-2 text-sm fade-in-fast"
          style={{ backgroundColor: "#f0fdf4", color: "#16a34a" }}
        >
          <Check className="h-4 w-4 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div>
        <Button
          type="submit"
          className="w-full text-white rounded-lg py-2.5"
          style={{ backgroundColor: "#0061ff" }}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            submitText
          )}
        </Button>

        {footerText && (
          <div
            className="mt-4 text-center text-sm"
            style={{ color: "#475569" }}
          >
            {footerText}
          </div>
        )}
      </div>
    </form>
  );
}
