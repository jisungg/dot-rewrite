"use client";

import Image from "next/image";
import {
  BerkeleyLogo,
  HarvardLogo,
  MITLogo,
  OxfordLogo,
  PrincetonLogo,
  StanfordLogo,
} from "@/data/logos/university_logos";

const logos = [
  { name: "Harvard University", logo: HarvardLogo },
  { name: "Stanford University", logo: StanfordLogo },
  { name: "MIT", logo: MITLogo },
  { name: "UC Berkeley", logo: BerkeleyLogo },
  { name: "Oxford University", logo: OxfordLogo },
  { name: "Princeton", logo: PrincetonLogo },
];

export default function LogoCloud() {
  return (
    <section className="relative mt-14">
      <p className="text-center text-sm text-zinc-900 mb-2">
        Trusted by students at leading educational institutions
      </p>

      <div className="flex flex-wrap justify-center items-center gap-8 mb-4 md:gap-12">
        {logos.map((item) => (
          <div
            key={item.name}
            className="flex items-center justify-center opacity-70 hover:opacity-100 hover:grayscale-0 transition-all"
          >
            <Image
              src={item.logo}
              alt={item.name}
              width={120}
              height={300}
              className="object-contain"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
