import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  Bell,
  Building2,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Pill,
  Settings,
  Shield,
  ShieldAlert,
  Stethoscope,
  Syringe,
  UserRound,
  Users
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { UserRole } from "../../types/models";
import { sidebarMotion } from "../../utils/animations";

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  role?: UserRole;
}

const navByRole: Record<UserRole, Array<{ to: string; label: string; icon: JSX.Element }>> = {
  patient: [{ to: "/patient", label: "Patient", icon: <Users className="h-4 w-4" /> }],
  doctor: [{ to: "/doctor", label: "Doctor", icon: <Stethoscope className="h-4 w-4" /> }],
  pharmacy: [{ to: "/pharmacy", label: "Pharmacy", icon: <Syringe className="h-4 w-4" /> }],
  super_admin: [
    { to: "/super-admin", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" /> },
    { to: "/super-admin/users", label: "Users", icon: <Users className="h-4 w-4" /> },
    { to: "/super-admin/hospitals", label: "Hospitals", icon: <Building2 className="h-4 w-4" /> },
    { to: "/super-admin/patients", label: "Patients", icon: <UserRound className="h-4 w-4" /> },
    { to: "/super-admin/triage-rules", label: "Triage Rules", icon: <ClipboardList className="h-4 w-4" /> },
    { to: "/super-admin/medicines", label: "Medicines", icon: <Pill className="h-4 w-4" /> },
    { to: "/super-admin/sms-logs", label: "SMS Logs", icon: <Bell className="h-4 w-4" /> },
    { to: "/super-admin/analytics", label: "Analytics", icon: <BarChart3 className="h-4 w-4" /> },
    { to: "/super-admin/logs", label: "Logs", icon: <FileText className="h-4 w-4" /> },
    { to: "/super-admin/settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
    { to: "/super-admin/security", label: "Security", icon: <ShieldAlert className="h-4 w-4" /> }
  ]
};

const SidebarContent = ({ collapsed, role, onCloseMobile }: Pick<SidebarProps, "collapsed" | "role" | "onCloseMobile">) => {
  const location = useLocation();
  const navItems = role ? navByRole[role] : [];

  return (
    <div className="h-full rounded-2xl bg-[#062b26] p-3 shadow-sm ring-1 ring-[#68ffb05e]">
      <div className="mb-4 flex items-center gap-2 px-2 py-1 text-white">
        <Shield className="h-5 w-5" />
        {!collapsed && <span className="text-sm font-semibold">Health Console</span>}
      </div>
      <div className="space-y-1">
        {navItems.map((item) => {
          const active = location.pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onCloseMobile}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
                active ? "bg-[#1a7d5e] text-white ring-1 ring-[#68ffb080]" : "text-emerald-50 hover:bg-[#0d4239]"
              }`}
            >
              {item.icon}
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export const Sidebar = ({ collapsed, mobileOpen, onCloseMobile, role }: SidebarProps) => {
  return (
    <>
      <motion.aside
        variants={sidebarMotion}
        animate={collapsed ? "closed" : "open"}
        className="hidden shrink-0 lg:block"
      >
        <SidebarContent collapsed={collapsed} role={role} onCloseMobile={onCloseMobile} />
      </motion.aside>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-slate-950/30 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onCloseMobile}
            />
            <motion.aside
              className="fixed left-0 top-0 z-50 h-full w-64 p-3 lg:hidden"
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.28 }}
            >
              <SidebarContent collapsed={false} role={role} onCloseMobile={onCloseMobile} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
