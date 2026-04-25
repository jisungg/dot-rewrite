import { Suspense } from "react";
import ChangelogHeader from "@/components/changelog/changelog-header";
import ChangelogEntries from "@/components/changelog/changelog-entries";
import Spinner from "@/components/ui/spinner";

export default function ChangelogHome() {
  return (
    <div className="relative w-full flex flex-col items-center pt-[72px]">
      <ChangelogHeader />
      <Suspense fallback={<Spinner />}>
        <ChangelogEntries />
      </Suspense>
    </div>
  );
}
