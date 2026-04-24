import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import PricingHeader from "@/components/pricing/pricing-header";
import PricingPlans from "@/components/pricing/pricing-plans";
import PricingFaq from "@/components/pricing/pricing-faq";

export default function PricingHome() {
  return (
    <div className="absolute inset-0 -z-10 h-full w-full bg-white">
      <Header />
      <div className="absolute bottom-0 left-0 right-0 top-0 pt-14 bg-[radial-gradient(circle_500px_at_50%_200px,#C9EBFF,transparent)]">
        <div className="relative mx-auto mt-4 flex flex-col items-center">
          <PricingHeader />
          <PricingPlans />
          <PricingFaq />
        </div>
        <div className="pt-20 pb-10">
          <Footer />
        </div>
      </div>
    </div>
  );
}
