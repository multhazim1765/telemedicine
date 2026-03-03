import { ReactNode } from "react";
import { motion } from "framer-motion";
import { cardHoverMotion } from "../../utils/animations";
import { AnimatedCounter } from "./AnimatedCounter";

interface DashboardCardProps {
  title: string;
  value: number;
  icon?: ReactNode;
  subtitle?: string;
}

export const DashboardCard = ({ title, value, icon, subtitle }: DashboardCardProps) => (
  <motion.article
    {...cardHoverMotion}
    className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200"
  >
    <div className="mb-1 flex items-center justify-between text-sm text-slate-600">
      <span>{title}</span>
      {icon}
    </div>
    <p className="text-2xl font-semibold text-slate-900">
      <AnimatedCounter value={value} />
    </p>
    {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
  </motion.article>
);
