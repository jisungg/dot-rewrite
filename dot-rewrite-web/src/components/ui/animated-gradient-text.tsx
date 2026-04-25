import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function AnimatedGradientText({
    children,
    className,
}: {
    children: ReactNode
    className?: string
}) {
    return (
        <div
            className={cn(
                "group relative mx-auto flex max-w-fit flex-row items-center justify-center rounded-2xl bg-white px-4 py-1.5 text-sm font-medium shadow-[inset_0_-8px_10px_#8fdfff1f,0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur-sm transition-shadow duration-500 ease-out [--bg-size:300%] hover:shadow-[inset_0_-5px_10px_#8fdfff3f,0_1px_2px_rgba(15,23,42,0.06)]",
                className,
            )}
        >
            <div className="animate-gradient absolute inset-0 block size-full bg-gradient-to-r from-[#0061ff]/50 via-[#60efff]/50 to-[#0061ff]/50 bg-[length:var(--bg-size)_100%] p-px ![mask-composite:subtract] [border-radius:inherit] [mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)]" />

            {children}
        </div>
    )
}
