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
    { to: "/super-admin/pharmacies", label: "Pharmacies", icon: <Syringe className="h-4 w-4" /> },
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
    <div className="h-full rounded-[1.7rem] bg-[#fffdf9] p-3 shadow-[0_18px_38px_rgba(70,49,35,0.08)] ring-1 ring-[#e8dccd]">
      <div className="mb-5 rounded-2xl bg-[linear-gradient(135deg,#fff8ef,#f7ebdd)] px-3 py-3 text-[#4a3425] ring-1 ring-[#eadac6]">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-[#824c2d]" />
          {!collapsed && <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8a5a28]">Care Network</span>}
        </div>
        {!collapsed && <p className="mt-2 text-xs text-[#7b6a5d]">Hospital operations dashboard</p>}
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
                active ? "bg-[linear-gradient(135deg,#f9eedb,#f4dfb7)] text-[#5b311e] ring-1 ring-[#e2c999]" : "text-[#6d584a] hover:bg-[#faf3ea]"
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
