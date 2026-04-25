import PricingHeader from "@/components/pricing/pricing-header";
import PricingPlans from "@/components/pricing/pricing-plans";
import PricingFaq from "@/components/pricing/pricing-faq";

export default function PricingHome() {
  return (
    <div className="relative w-full pt-[72px] flex flex-col items-center">
      <div className="w-full max-w-5xl px-4">
        <PricingHeader />
        <PricingPlans />
        <PricingFaq />
      </div>
    </div>
  );
}
