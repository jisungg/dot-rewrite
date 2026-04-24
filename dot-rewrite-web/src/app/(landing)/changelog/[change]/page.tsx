import { Suspense } from "react";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import ChangelogVersionHeader from "@/components/changelog/changelog-version-header";
import ChangelogContent from "@/components/changelog/changelog-content";
import Spinner from "@/components/ui/spinner";

export default async function ChangelogEntry({
  params,
}: {
  params: Promise<{ change: string }>;
}) {
  const { change } = await params;

  return (
    <div className="absolute inset-0 -z-10 h-full w-full bg-white">
      <Header />
      <div className="absolute bottom-0 left-0 right-0 top-0 pt-14 bg-[radial-gradient(circle_500px_at_50%_200px,#C9EBFF,transparent)]">
        <div className="relative mx-auto mt-4 flex flex-col items-center">
          <Suspense fallback={<Spinner />}>
            <ChangelogVersionHeader version={change} />
            <ChangelogContent version={change} />
          </Suspense>
        </div>
        <div className="pt-20 pb-10">
          <Footer />
        </div>
      </div>
    </div>
  );
}
