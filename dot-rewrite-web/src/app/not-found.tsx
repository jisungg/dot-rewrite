import Link from "next/link";
import Footer from "@/components/layout/footer";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="absolute inset-0 -z-10 h-full w-full bg-white">
      <Header />
      <div className="absolute bottom-0 left-0 right-0 top-0 pt-14 bg-[radial-gradient(circle_500px_at_50%_200px,#C9EBFF,transparent)]">
        <div className="relative mx-auto my-40 flex flex-col items-center">
          <h2 className="text-center text-4xl font-medium text-zinc-900">
            404
          </h2>
          <p className="mt-6 text-center text-xl leading-6 text-zinc-600">
            The page you&apos;re looking for doesn&apos;t exist or has been
            moved.
          </p>

          <div className="flex space-x-6 mt-8">
            <Link href="/">
              <Button
                variant="outline"
                className="border-gray-200 text-[#0061ff] hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200"
              >
                Go to homepage
              </Button>
            </Link>
          </div>
        </div>
        <div className="pt-20 pb-10">
          <Footer />
        </div>
      </div>
    </div>
  );
}
