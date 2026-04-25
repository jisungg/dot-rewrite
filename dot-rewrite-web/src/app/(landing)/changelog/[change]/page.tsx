import { Suspense } from "react";
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
    <div className="relative mx-auto mt-4 flex flex-col items-center pt-14">
      <Suspense fallback={<Spinner />}>
        <ChangelogVersionHeader version={change} />
        <ChangelogContent version={change} />
      </Suspense>
    </div>
  );
}
