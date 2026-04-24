"use client"

import type React from "react"

import { motion } from "framer-motion"

interface GradientTextProps {
    children: React.ReactNode
    delay?: number
}

export function GradientText({ children, delay = 0.5 }: GradientTextProps) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay }}
            className="relative"
        >
            <motion.div
                className="text-xs sm:text-sm font-medium text-center leading-relaxed bg-clip-text text-transparent bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500"
                style={{
                    backgroundSize: "200% 200%",
                }}
                animate={{
                    backgroundPosition: ["0% 0%", "100% 100%"],
                }}
                transition={{
                    duration: 5,
                    repeat: Number.POSITIVE_INFINITY,
                    repeatType: "reverse",
                    ease: "linear",
                }}
            >
                {children}
            </motion.div>
        </motion.div>
    )
}
