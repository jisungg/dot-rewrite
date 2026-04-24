import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

export function SmtpMessage() {
  return (
    <div className="bg-muted/50 max-w-2xl px-5 py-3 mt-5 border rounded-md flex gap-4">
      <div className="flex flex-col gap-1">
        <small className="text-sm text-secondary-foreground">
          By signing up, you agree to our terms of service and privacy policy.
          We use cookies for analytics and personalized content. We do not
          share your personal information with third parties.
        </small>
        <div className="mt-4">
          <Link
            href="/terms-of-service"
            target="_blank"
            className="text-primary/50 hover:text-primary flex items-center text-sm gap-1"
          >
            Terms of Service <ArrowUpRight size={14} />
          </Link>
          <Link
            href="/privacy-policy"
            target="_blank"
            className="text-primary/50 hover:text-primary flex items-center text-sm gap-1"
          >
            Privacy Policy <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
