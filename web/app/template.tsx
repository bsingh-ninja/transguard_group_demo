"use client";

import { motion } from "motion/react";

/** Each screen fades in when you navigate (opacity only: a transform here would break the fixed-position sheets). */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.28, ease: "easeOut" }}>
      {children}
    </motion.div>
  );
}
