import { Link, Outlet, useLocation } from "react-router-dom";
import { DashboardLayout } from "../../components/DashboardLayout";

const tabs = [
  { to: "/super-admin", label: "Overview" },
  { to: "/super-admin/users", label: "Users" },
  { to: "/super-admin/hospitals", label: "Hospitals" },
  { to: "/super-admin/patients", label: "Patients" },
  { to: "/super-admin/triage-rules", label: "Triage Rules" },
  { to: "/super-admin/medicines", label: "Medicines" },
  { to: "/super-admin/sms-logs", label: "SMS Logs" },
  { to: "/super-admin/analytics", label: "Analytics" },
  { to: "/super-admin/logs", label: "Logs" },
  { to: "/super-admin/settings", label: "Settings" },
  { to: "/super-admin/security", label: "Security" }
];

export const SuperAdminLayout = () => {
  const location = useLocation();

  return (
    <DashboardLayout title="Super Admin Dashboard">
      <section className="mb-4 flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const active = location.pathname === tab.to;
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={`rounded-xl px-4 py-2 text-sm transition ${
                active ? "bg-[#2BB673] text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </section>
      <Outlet />
    </DashboardLayout>
  );
};
