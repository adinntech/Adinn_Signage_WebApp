"use client";

import Image from "next/image";
import { motion } from "framer-motion";
/** Left half of the auth screens: the ADINN brand artwork (logo, tagline and Plan/Survey/Execute/Grow are part of the image). */
export function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-[#0a1a3a] lg:block">
      <motion.div className="absolute inset-0" initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, ease: "easeOut" }}>
        {/* <Image src="/Images/LoginPageImg2.png" alt="ADINN Signage Solutions: transforming spaces with signage intelligence" fill priority  className="object-cover" /> */}
        <Image
          src="/Images/LoginPageImg2.png"
          alt="ADINN Signage Solutions"
          fill
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          
        />
      </motion.div>
    </aside>
  );
}
