"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CreditCard, FileText, LineChart, Zap } from "lucide-react";

type Feature = {
  icon: ReactNode;
  title: string;
  description: string;
};

const features: Feature[] = [
  {
    icon: <CreditCard className="h-6 w-6 text-blue-600" />,
    title: "Meet Dot",
    description:
      "Dot is your personal study assistant, built from your notes, trained on your class. No generic data, no outside noise. Just your material, made smart.",
  },
  {
    icon: <Zap className="h-6 w-6 text-blue-600" />,
    title: "Keep it in Scope",
    description:
      "Ask questions like “What did Prof. Johnson cover in week 3?” or “How did Prof. Natalie explain integration?” Dot will source directly from your course notes instead of vaguely guessing with generic internet searches. Every answer is grounded in exactly what your professor covered.",
  },
  {
    icon: <LineChart className="h-6 w-6 text-blue-600" />,
    title: "Minimalist-Focused Central",
    description:
      "Each class you create becomes a structured workspace: files, chats, quizzes, and AI conversations all live together. Seamlessly switch between classes and stay in control without digging through folders.",
  },
  {
    icon: <FileText className="h-6 w-6 text-blue-600" />,
    title: "Built for You",
    description:
      ".note is designed to match your learning style — not force you into one. Upload messy handwriting or pristine slides — the platform adapts to you. The interface is minimal, flexible, and designed to keep you in flow. Just you, your class, and your AIs.",
  },
];

const ROTATE_MS = 5000;
const PROGRESS_STEP_MS = 50;

export default function FeatureShowcase() {
  const [activeFeature, setActiveFeature] = useState(0);
  const [progress, setProgress] = useState(0);
  const rotateRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startProgress = () => {
    if (progressRef.current) clearInterval(progressRef.current);
    setProgress(0);
    progressRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          if (progressRef.current) clearInterval(progressRef.current);
          return 0;
        }
        return prev + 1;
      });
    }, PROGRESS_STEP_MS);
  };

  const startRotation = () => {
    if (rotateRef.current) clearInterval(rotateRef.current);
    rotateRef.current = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % features.length);
      startProgress();
    }, ROTATE_MS);
  };

  useEffect(() => {
    startProgress();
    startRotation();
    return () => {
      if (rotateRef.current) clearInterval(rotateRef.current);
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, []);

  const handleFeatureClick = (index: number) => {
    setActiveFeature(index);
    startProgress();
    startRotation();
  };

  const active = features[activeFeature]!;

  return (
    <div className="grid md:grid-cols-2 gap-12 max-w-7xl w-full px-6 mx-auto items-center">
      <div className="space-y-8">
        {features.map((feature, index) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className={`cursor-pointer transition-all duration-300 ${
              activeFeature === index
                ? "scale-105"
                : "opacity-70 hover:opacity-100"
            }`}
            onClick={() => handleFeatureClick(index)}
          >
            <div className="flex items-start gap-4">
              <div>
                <h3 className="text-xl font-medium mb-2">{feature.title}</h3>
                <p className="text-slate-600 mb-3">{feature.description}</p>
                <div className="h-1 bg-slate-100 rounded-full w-full overflow-hidden">
                  <motion.div
                    className="h-full bg-[#0061ff] rounded-full"
                    initial={{ width: "0%" }}
                    animate={{
                      width: activeFeature === index ? `${progress}%` : "0%",
                    }}
                    transition={{ duration: 0.1, ease: "linear" }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-slate-100 shadow-lg bg-white">
        <div className="absolute top-0 left-0 right-0 h-8 bg-slate-50 border-b border-slate-100 flex items-center px-4">
          <div className="flex space-x-2">
            <div className="w-3 h-3 rounded-full bg-slate-200" />
            <div className="w-3 h-3 rounded-full bg-slate-200" />
            <div className="w-3 h-3 rounded-full bg-slate-200" />
          </div>
        </div>
        <div className="pt-8 h-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeFeature}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="h-full w-full flex items-center justify-center p-4"
            >
              <div className="relative w-full h-full rounded-lg overflow-hidden bg-gradient-to-br from-blue-50 to-slate-50">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    {active.icon}
                    <p className="mt-4 text-lg font-medium text-blue-600">
                      {active.title}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
