"use client";

import { type ReactNode, useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
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
    <motion.form
      onSubmit={handleSubmit}
      className="space-y-4 p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.4 }}
    >
      {fields.map((field, index) => (
        <motion.div
          key={field.id}
          className="space-y-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 + index * 0.1 }}
        >
          <Label
            htmlFor={field.id}
            className="text-sm font-medium text-slate-700 flex justify-between"
          >
            <span>
              {field.label}{" "}
              {field.required && <span className="text-red-500">*</span>}
            </span>
            <AnimatePresence>
              {errors[field.id] && touched[field.id] && (
                <motion.span
                  className="text-xs text-red-500 flex items-center"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                >
                  <X className="h-3 w-3 mr-1" />
                  {errors[field.id]}
                </motion.span>
              )}
            </AnimatePresence>
          </Label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500">
              {field.icon}
            </div>
            <Input
              id={field.id}
              type={field.type}
              placeholder={field.placeholder}
              className={`pl-10 border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-lg ${
                errors[field.id] && touched[field.id]
                  ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                  : ""
              }`}
              value={formData[field.id] ?? ""}
              onChange={handleChange}
              onBlur={handleBlur}
            />
          </div>
        </motion.div>
      ))}

      <AnimatePresence>
        {formError && (
          <motion.div
            className="bg-red-50 text-red-600 p-3 rounded-lg flex items-center gap-2 text-sm"
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -10, height: 0 }}
          >
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{formError}</span>
            <button
              type="button"
              className="ml-auto text-red-400 hover:text-red-600"
              onClick={() => setFormError("")}
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}

        {success && (
          <motion.div
            className="bg-green-50 text-green-600 p-3 rounded-lg flex items-center gap-2 text-sm"
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -10, height: 0 }}
          >
            <Check className="h-4 w-4 flex-shrink-0" />
            <span>{success}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
      >
        <Button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2.5"
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
          <div className="mt-4 text-center text-sm text-slate-600">
            {footerText}
          </div>
        )}
      </motion.div>
    </motion.form>
  );
}
