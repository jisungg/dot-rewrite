"use client";

import Image from "next/image";
import { BerkeleyLogo } from "@/data/logos/university_logos";

export default function LogoCloud() {
  return (
    <section className="relative mt-14">
      <p className="text-center text-sm text-zinc-900 mb-1">
        Trusted by Jisung, at a leading educational institution
      </p>
      <p className="text-center text-xs text-zinc-500 mb-3">
        Active users: 1. Retention: 100%. Growth: pending.
      </p>

      <div className="flex justify-center items-center mb-4">
        <div className="flex items-center justify-center opacity-70 hover:opacity-100 transition-all">
          <Image
            src={BerkeleyLogo}
            alt="UC Berkeley"
            width={120}
            height={300}
            className="object-contain"
          />
        </div>
      </div>
    </section>
  );
}
