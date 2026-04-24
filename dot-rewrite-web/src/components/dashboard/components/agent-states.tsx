"use client";

import { TextEffect, TextRoll } from "@/components/effects";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { GradientText } from "@/components/ui/gradient-text";
import { AgentInformation } from "@/data/types";
import {
  fadeInScale,
  pulseVariants,
  springTransition,
  staggerContainerVariants,
  staggerItemVariants,
} from "@/lib/animations";
import { AnimatePresence, motion } from "motion/react";
import { Clock, Sparkles } from "lucide-react";

function CircularProgress({
  progress,
  size = 80,
  strokeWidth = 4,
  children,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative inline-flex group">
      <motion.div
        className="absolute -inset-4 bg-blue-500/5 rounded-full blur-lg"
        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />

      <svg
        width={size}
        height={size}
        className="transform -rotate-90 rounded-full"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(59, 130, 246, 0.1)"
          strokeWidth={strokeWidth}
          className="transition-all duration-300"
        />

        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
        />
      </svg>

      <div className="absolute inset-0 flex items-center justify-center rounded-full">
        <motion.div
          variants={pulseVariants}
          animate="animate"
          className="rounded-full flex flex-col items-center"
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}

export function LoadingState({
  agent,
  elapsedTime = 0,
  loadingMessage,
}: {
  agent: typeof AgentInformation;
  elapsedTime?: number;
  loadingMessage: string;
}) {
  const progress = Math.min(
    (elapsedTime / (agent.averageTime || 30)) * 100,
    100,
  );

  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={{
        initial: { opacity: 0 },
        animate: {
          opacity: 1,
          transition: {
            duration: 0.4,
            ease: [0.32, 0.72, 0, 1],
            when: "beforeChildren",
            staggerChildren: 0.1,
          },
        },
        exit: {
          opacity: 0,
          transition: {
            duration: 0.2,
            ease: [0.32, 0.72, 0, 1],
            when: "afterChildren",
            staggerChildren: 0.05,
            staggerDirection: -1,
          },
        },
      }}
      className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center"
    >
      <div className="max-w-2xl w-full space-y-8">
        <motion.div variants={staggerItemVariants} className="space-y-1">
          <div className="space-y-1">
            <TextRoll className="text-lg lg:text-3xl font-bold text-neutral-900 dark:text-zinc-100">
              {agent.name}
            </TextRoll>
          </div>
          <motion.div
            className="inline-flex items-center gap-3 text-xs font-medium min-w-24 border border-blue-100 dark:border-blue-900/50 p-1 px-1.5 rounded-full"
            whileHover={{ y: -2 }}
            transition={springTransition}
          >
            <CircularProgress size={30} strokeWidth={2} progress={progress}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="size-5 text-blue-600"
              >
                <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
                  <motion.path
                    d="M12 4.75v1.5M17.127 6.873l-1.061 1.061M19.25 12h-1.5M17.127 17.127l-1.061-1.061M12 17.75v1.5M7.873 17.127l1.061-1.061M4.75 12h1.5M7.873 6.873l1.061 1.061"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="drop-shadow-sm"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{
                      duration: 1.5,
                      ease: "easeInOut",
                      repeat: Infinity,
                    }}
                  />
                </svg>
              </motion.div>
            </CircularProgress>
            <div className="text-sm font-medium text-blue-600">
              {Math.round(progress)}%
            </div>

            <span className="text-sm font-medium text-neutral-800 dark:text-zinc-200">
              Estimated Time
            </span>
            <div className="w-1 h-1 rounded-full bg-blue-200 dark:bg-blue-800" />
            <span className="text-sm text-blue-600 dark:text-blue-400 flex items-center font-medium">
              <Clock className="w-4 h-4 mr-1.5 text-blue-500 dark:text-blue-400" />
              {agent.averageTime}s
            </span>
          </motion.div>
        </motion.div>

        <motion.div variants={staggerItemVariants} className="w-full">
          <motion.div
            variants={fadeInScale}
            className="rounded-2xl bg-white/95 dark:bg-zinc-900/80 border border-gray-100/80 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden"
          >
            <div className="px-4 sm:px-6 py-3 border-b border-gray-100/80 dark:border-zinc-800 bg-neutral-50/50 dark:bg-zinc-800/40">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                <div className="text-xs sm:text-sm font-medium text-neutral-700 dark:text-zinc-200">
                  Details
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-6 text-left">
              <motion.div
                variants={staggerContainerVariants}
                initial="initial"
                animate="animate"
                className="space-y-6"
              >
                <motion.div
                  variants={staggerItemVariants}
                  className="space-y-2"
                >
                  <AnimatePresence
                    mode="wait"
                    key={`gradient-${loadingMessage}`}
                  >
                    <GradientText>{loadingMessage}</GradientText>
                  </AnimatePresence>
                </motion.div>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}

export function EmptyState({
  agent,
}: {
  agent: {
    name: string;
    description: string;
    context: string;
    parameter: string;
    inputFields: ReadonlyArray<{
      name: string;
      type: string;
      label: string;
      placeholder: string;
      description: string;
    }>;
    input: string;
    output: string;
    resultTabs?: ReadonlyArray<string>;
    tools?: ReadonlyArray<{ name: string; description: string }>;
    steps?: ReadonlyArray<string>;
    averageTime?: number;
    capabilities?: ReadonlyArray<string>;
  };
}) {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={{
        initial: { opacity: 0 },
        animate: {
          opacity: 1,
          transition: {
            duration: 0.4,
            ease: [0.32, 0.72, 0, 1],
            when: "beforeChildren",
            staggerChildren: 0.1,
          },
        },
        exit: {
          opacity: 0,
          transition: {
            duration: 0.2,
            ease: [0.32, 0.72, 0, 1],
            when: "afterChildren",
            staggerChildren: 0.05,
            staggerDirection: -1,
          },
        },
      }}
    >
      <Card className="mt-1 pt-1 p-0 space-y-8 rounded-2xl border-none bg-white dark:bg-zinc-900 shadow-[0px_1px_1px_0px_rgba(0,_0,_0,_0.05),_0px_1px_1px_0px_rgba(255,_252,_240,_0.5)_inset,_0px_0px_0px_1px_hsla(0,_0%,_100%,_0.1)_inset,_0px_0px_1px_0px_rgba(28,_27,_26,_0.5)]">
        <div className="p-4 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <div>
                <div className="flex items-center pb-1 gap-2">
                  <div
                    key={agent.name}
                    className="flex items-center gap-1 text-sm font-medium lg:text-xl lg:font-semibold text-neutral-900 dark:text-zinc-100"
                  >
                    <TextEffect className="text-neutral-900 dark:text-zinc-100">
                      {agent.name}
                    </TextEffect>
                  </div>
                </div>
              </div>
            </div>
            <motion.p
              key={agent.context}
              variants={staggerItemVariants}
              className="text-sm text-neutral-600 dark:text-zinc-400 text-pretty lg:pr-6"
            >
              {agent.context}
            </motion.p>
          </div>

          <motion.div
            key={`${agent.name}-details`}
            variants={staggerItemVariants}
            className="space-y-4 text-sm"
          >
            <div className="p-4 bg-neutral-50 dark:bg-zinc-800/40 rounded-lg shadow-[0px_1px_1px_0px_rgba(0,_0,_0,_0.05),_0px_1px_1px_0px_rgba(255,_252,_240,_0.5)_inset,_0px_0px_0px_1px_hsla(0,_0%,_100%,_0.1)_inset,_0px_0px_1px_0px_rgba(28,_27,_26,_0.5)] space-y-4">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-neutral-900 dark:text-zinc-100 mb-2 text-xs">
                    How to use {agent.name}
                  </h4>
                  <div className="space-y-2 text-xs">
                    {agent.inputFields.map((field, index) => (
                      <div
                        key={field.name + index}
                        className="flex items-center gap-2 text-neutral-600 dark:text-zinc-300"
                      >
                        <Badge variant="outline" className="mt-0.5">
                          {index + 1}.
                        </Badge>
                        <div>
                          <span className="font-medium">{field.label}</span>
                          <p className="text-xs text-neutral-500 dark:text-zinc-400 mt-0.5">
                            {field.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </Card>
    </motion.div>
  );
}
