import PricingHeader from "@/components/pricing/pricing-header";
import PricingPlans from "@/components/pricing/pricing-plans";
import PricingFaq from "@/components/pricing/pricing-faq";

export default function PricingHome() {
  return (
    <div className="relative w-full pt-[72px]">
      <PricingHeader />
      <PricingPlans />
      <PricingFaq />
    </div>
  );
}
