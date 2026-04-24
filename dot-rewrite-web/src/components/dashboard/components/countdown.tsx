"use client";

import { cn } from "@/lib/utils";
import NumberFlow, { NumberFlowGroup } from "@number-flow/react";
import { motion } from "motion/react";

const Clock02Icon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width={24}
    height={24}
    color="#000000"
    fill="none"
    {...props}
  >
    <circle opacity="0.4" cx="12" cy="12" r="10" fill="currentColor" />
    <path
      d="M5.04798 8.60657L2.53784 8.45376C4.33712 3.70477 9.503 0.999914 14.5396 2.34474C19.904 3.77711 23.0904 9.26107 21.6565 14.5935C20.2227 19.926 14.7116 23.0876 9.3472 21.6553C5.36419 20.5917 2.58192 17.2946 2 13.4844"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12 8V12L14 14"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export function Countdown({
  seconds,
  milliseconds,
  loading,
  className,
}: {
  seconds: number;
  milliseconds: number;
  loading?: boolean;
  className?: string;
}) {
  const ss = seconds;
  const ms = Math.floor(milliseconds / 10);

  return (
    <motion.div
      layoutId="countdown"
      key={seconds === 0 ? "countdown-0" : "countdown"}
      className={cn(
        "flex items-center gap-2 text-xs font-medium bg-white/90 dark:bg-zinc-800/80 px-2.5 py-1.5 rounded-full",
        "shadow-[0_2px_4px_rgba(0,0,0,0.02),_0_1px_2px_rgba(0,0,0,0.04)]",
        "h-7 min-w-24",
        "shadow-[inset_0px_-2.10843px_0px_0px_rgb(244,241,238),_0px_1.20482px_6.3253px_0px_rgb(244,241,238)] dark:shadow-none",
        "border border-[#E9E3DD] dark:border-zinc-700 text-[#36322F] dark:text-zinc-200",
        loading ? "text-blue-500 dark:text-blue-400" : "text-neutral-500 dark:text-zinc-300",
        className,
      )}
    >
      <Clock02Icon
        className={cn(
          "w-3.5 h-3.5",
          loading && "animate-[spin_3s_linear_infinite]",
        )}
      />
      <NumberFlowGroup>
        <div
          style={{ fontVariantNumeric: "tabular-nums" } as React.CSSProperties}
          className="flex items-baseline font-medium tracking-tight"
        >
          <div className="flex items-baseline gap-[2px]">
            <NumberFlow
              value={ss}
              format={{ minimumIntegerDigits: 2 }}
              className={cn(
                "text-sm transition-colors duration-200",
                loading ? "text-blue-600" : "text-neutral-600",
              )}
            />
            <span
              className={cn(
                "text-[10px] font-medium transition-colors duration-200",
                loading ? "text-blue-400" : "text-neutral-400",
              )}
            >
              s
            </span>
          </div>
          <span
            className={cn(
              "mx-0.5 transition-colors duration-200",
              loading ? "text-blue-400/70" : "text-neutral-300",
            )}
          >
            .
          </span>
          <div className="flex items-baseline">
            <NumberFlow
              value={ms}
              format={{ minimumIntegerDigits: 2 }}
              className={cn(
                "text-sm transition-colors duration-200",
                loading ? "text-blue-500" : "text-neutral-500",
              )}
            />
            <span
              className={cn(
                "text-[10px] font-medium transition-colors duration-200 ml-0.5",
                loading ? "text-blue-400" : "text-neutral-400",
              )}
            >
              ms
            </span>
          </div>
        </div>
      </NumberFlowGroup>
    </motion.div>
  );
}
