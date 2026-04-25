"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "Is Free really free?",
    answer:
      "Yes, permanently. No trial, no card. You get the editor, notes, spaces (up to 3), the basic Nexus graph, basic Insights, and daily allowances of Dot, Letters, Understand, Exam, and summaries.",
  },
  {
    question: "What changes when I go Plus?",
    answer:
      "Daily caps disappear, spaces and notes go unlimited, and the full Nexus intelligence layer unlocks: anchors (god-nodes), bridges, typed relations (LLM-extracted on bridges + anchors), labeled communities, and all 7 Insight kinds (bridges, dependency chains, contradictions, concept reach, emerging clusters, plus the two Free already shows).",
  },
  {
    question: "What happens when I hit a free cap?",
    answer:
      "We warn you at 80% with a soft toast and stop you at 100% with a one-click upgrade prompt. Caps reset at midnight UTC (or weekly for Exam). No silent failures, no surprise charges.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Yes. Plus is month-to-month (or annual at a discount). When you cancel, you keep Plus access until the end of the period. After that, your account drops back to Free with all your data intact; nothing is deleted.",
  },
  {
    question: "Will I lose my notes if I downgrade?",
    answer:
      "No. Your notes, spaces, and chat history all stay. If you exceed Free limits after downgrade (e.g. you have 8 spaces and Free allows 3), the existing data stays read-only; new spaces or notes are paused until you upgrade or trim down.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "All major credit cards via Stripe. Annual plans available at a discount (~28% off the monthly equivalent).",
  },
];

export default function PricingFaq() {
  return (
    <section className="w-full py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto w-full max-w-3xl">
          <div className="text-center mb-12 fade-in-fast">
            <h2 className="text-3xl font-medium tracking-tight text-zinc-900">
              Frequently asked questions
            </h2>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem
                  key={faq.question}
                  value={`item-${index}`}
                  className="px-6"
                >
                  <AccordionTrigger className="py-4 text-left font-medium text-zinc-900 hover:text-[#0061ff] hover:no-underline">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 text-zinc-600 leading-relaxed">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </div>
    </section>
  );
}
