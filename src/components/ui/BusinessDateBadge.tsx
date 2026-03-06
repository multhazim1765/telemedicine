import { useBusinessDate } from "../../hooks/useBusinessDate";

interface BusinessDateBadgeProps {
  label?: string;
}

export const BusinessDateBadge = ({ label = "Data shown for" }: BusinessDateBadgeProps) => {
  const businessDate = useBusinessDate();

  return (
    <div className="mb-3 inline-flex items-center rounded-lg bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
      {label}: {businessDate}
    </div>
  );
};
