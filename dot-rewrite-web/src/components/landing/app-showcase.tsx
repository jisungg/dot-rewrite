"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Apple } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppShowcaseCTA() {
  return (
    <div className="max-w-5xl mx-auto">
      <motion.div
        className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden"
        initial={{ y: 20, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        viewport={{ once: true }}
      >
        <div className="bg-gray-50 border-b border-gray-200 p-2 flex items-center">
          <div className="flex space-x-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <div className="mx-auto text-sm text-gray-500 font-medium">.note</div>
        </div>

        <div className="flex flex-col md:flex-row">
          <div className="w-full md:w-64 bg-gray-50 border-r border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                JD
              </div>
              <div className="font-medium">John Doe</div>
            </div>

            <div className="space-y-1 mb-6">
              <div className="text-xs uppercase text-gray-500 font-medium mb-2">
                My Courses
              </div>
              <div className="px-3 py-2 rounded-md bg-blue-50 text-blue-700 font-medium text-sm">
                Physics 101
              </div>
              <div className="px-3 py-2 rounded-md text-gray-700 text-sm hover:bg-gray-100">
                Calculus II
              </div>
              <div className="px-3 py-2 rounded-md text-gray-700 text-sm hover:bg-gray-100">
                Computer Science
              </div>
            </div>

            <div className="space-y-1 mb-6">
              <div className="text-xs uppercase text-gray-500 font-medium mb-2">
                Active Letters
              </div>
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md">
                <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                  M
                </div>
                <span>Math</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md">
                <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold text-xs">
                  S
                </div>
                <span>Science</span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs uppercase text-gray-500 font-medium mb-2">
                Knowledge Map
              </div>
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md">
                <span>Nexus</span>
              </div>
            </div>
          </div>

          <div className="flex-1 p-6">
            <div className="mb-6">
              <h3 className="text-xl font-medium text-zinc-900 mb-2">
                Physics 101
              </h3>
              <div className="flex items-center text-sm text-gray-500">
                <span>Last updated: Today at 2:45 PM</span>
                <span className="mx-2">•</span>
                <span>12 notes</span>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                  D
                </div>
                <div>
                  <div className="text-sm font-medium">Ask Dot</div>
                  <div className="text-xs text-gray-500">
                    Trained on your Physics 101 materials
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-md border border-gray-200 p-3 mb-3">
                <div className="text-sm text-gray-700">
                  Explain Newton&apos;s Second Law and how it relates to the
                  concept of momentum.
                </div>
              </div>
              <div className="bg-blue-50 rounded-md border border-blue-100 p-3">
                <div className="text-sm text-gray-700">
                  <p className="mb-2">Based on your lecture notes from Week 3:</p>
                  <p className="mb-2">
                    Newton&apos;s Second Law states that the acceleration of an
                    object is directly proportional to the net force acting on
                    it and inversely proportional to its mass. Mathematically: F
                    = ma.
                  </p>
                  <p>
                    This relates to momentum (p = mv) because force can also be
                    expressed as the rate of change of momentum: F = dp/dt. When
                    mass is constant, this simplifies to F = m(dv/dt) = ma,
                    connecting the two concepts.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {["Kinematics", "Forces", "Newton's Laws", "Momentum"].map(
                (tag) => (
                  <div
                    key={tag}
                    className="px-4 py-2 bg-gray-100 rounded-full text-sm text-gray-700"
                  >
                    {tag}
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      </motion.div>

      <div className="mt-12 text-center">
        <Link href="/sign-up">
          <Button
            variant="outline"
            className="border-gray-200 text-[#0061ff] hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200"
          >
            Get Started <Apple className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
