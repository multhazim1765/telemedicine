import { motion } from "framer-motion";
import { Activity } from "lucide-react";

export const MedicalSpinner = ({
  fullScreen = false,
  label = "Opening care tools",
  message = "Bringing the next screen online"
}: {
  fullScreen?: boolean;
  label?: string;
  message?: string;
}) => (
  <div className={fullScreen ? "mascot-loader mascot-loader-fullscreen" : "mascot-loader"}>
    <div className="mascot-loader-panel">
      <motion.div
        className="mascot-loader-orbit"
        animate={{ rotate: 360 }}
        transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
      >
        <span className="mascot-loader-node mascot-loader-node-large" />
        <span className="mascot-loader-node mascot-loader-node-small" />
      </motion.div>
      <motion.img
        src="/doctor-3d.svg"
        alt="Telehealth mascot"
        className="mascot-loader-image"
        animate={{ y: [0, -10, 0], scale: [1, 1.02, 1] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="mascot-loader-copy">
        <p className="mascot-loader-label">{label}</p>
        <p className="mascot-loader-message">{message}</p>
      </div>
      <motion.div
        className="mascot-loader-pulse"
        animate={{ scaleX: [0.24, 1, 0.24], opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      >
        <Activity className="h-4 w-4" />
      </motion.div>
    </div>
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
