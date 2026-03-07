import { ReactNode, useState } from "react";
import { motion } from "framer-motion";
import { Sidebar } from "./Sidebar";
import { TopNavbar } from "./TopNavbar";
import { useAuth } from "../../hooks/useAuth";
import { pageTransition } from "../../utils/animations";

interface DashboardShellProps {
  title: string;
  children: ReactNode;
}

export const DashboardShell = ({ title, children }: DashboardShellProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(211,164,95,0.14),_transparent_18%),linear-gradient(180deg,_#fbf8f3,_#f2e8dc)] p-3 sm:p-4 dashboard-theme">
      <div className="mx-auto flex max-w-7xl gap-3">
        <Sidebar
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
          role={user?.role}
        />

        <div className="min-w-0 flex-1">
          <TopNavbar
            title={title}
            user={user}
            onToggleSidebar={() => setCollapsed((v) => !v)}
            onToggleMobileSidebar={() => setMobileOpen((v) => !v)}
          />

          <motion.div variants={pageTransition} initial="initial" animate="animate" exit="exit">
            {children}
          </motion.div>
        </div>
      </div>
    </main>
  );
};
