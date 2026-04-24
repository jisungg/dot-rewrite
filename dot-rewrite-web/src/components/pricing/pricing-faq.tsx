"use client";

import { motion } from "motion/react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "How do I verify my student status?",
    answer:
      "To verify your student status, click on the 'Verify student status' button and upload a valid student ID or enrollment verification from your educational institution. Our team will review your submission within 24 hours.",
  },
  {
    question: "Can I change plans later?",
    answer:
      "Yes, you can upgrade or downgrade your plan at any time. Changes will be applied immediately, and your billing will be adjusted accordingly.",
  },
  {
    question: "Do you offer additional student discounts?",
    answer:
      "Our Verified Student plan already offers a significant discount. For educational institutions looking to provide .note to multiple students, please contact our sales team for special group rates.",
  },
  {
    question: "Can I cancel my subscription anytime?",
    answer:
      "Yes, you can cancel your subscription at any time. Your access will continue until the end of your billing period.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "We accept all major credit cards, PayPal, and Apple Pay. For annual plans, we also offer invoicing options.",
  },
  {
    question: "Is there a limit to how many subjects I can study?",
    answer:
      "No, there's no limit to the number of subjects. You can organize your materials into different subjects and courses as needed.",
  },
];

export default function PricingFaq() {
  return (
    <section className="py-24">
      <div className="container">
        <div className="max-w-3xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <h2 className="text-3xl font-medium tracking-tight text-gray-900">
              Frequently asked questions
            </h2>
          </motion.div>

          <motion.div
            className="bg-white rounded-xl shadow-sm overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
          >
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={faq.question} value={`item-${index}`}>
                  <AccordionTrigger className="px-6 py-4 text-left font-medium text-gray-900 hover:text-[#0061ff] hover:no-underline">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-4 text-gray-600">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
