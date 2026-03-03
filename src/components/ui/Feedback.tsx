import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

export const MedicalSpinner = () => (
  <div className="flex items-center justify-center p-6">
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      className="rounded-full bg-cyan-100 p-3 text-cyan-700"
    >
      <Loader2 className="h-5 w-5" />
    </motion.div>
  </div>
);

export const SkeletonCards = ({ count = 3 }: { count?: number }) => (
  <div className="grid gap-3 md:grid-cols-3">
    {Array.from({ length: count }).map((_, index) => (
      <motion.div
        key={index}
        initial={{ opacity: 0.4 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, repeat: Infinity, repeatType: "reverse" }}
        className="h-28 rounded-2xl bg-slate-200/70"
      />
    ))}
  </div>
);
