import { AnimatePresence, motion } from "framer-motion";
import { Bell, ChevronDown, LogOut, Menu, Search } from "lucide-react";
import { useState } from "react";
import { logout } from "../../services/authService";
import { AppUser } from "../../types/models";

interface TopNavbarProps {
  title: string;
  user: AppUser | null;
  onToggleSidebar: () => void;
  onToggleMobileSidebar: () => void;
}

export const TopNavbar = ({ title, user, onToggleSidebar, onToggleMobileSidebar }: TopNavbarProps) => {
  const [openProfile, setOpenProfile] = useState(false);

  return (
    <header className="sticky top-3 z-30 mb-4 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center gap-2">
        <button className="btn-muted lg:hidden" onClick={onToggleMobileSidebar}>
          <Menu className="h-4 w-4" />
        </button>
        <button className="btn-muted hidden lg:inline-flex" onClick={onToggleSidebar}>Toggle</button>
        <h1 className="text-lg font-semibold text-slate-800">{title}</h1>

        <div className="mx-auto hidden max-w-sm flex-1 items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 md:flex">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            className="w-full bg-transparent text-sm text-slate-700 outline-none"
            placeholder="Search patients, appointments..."
          />
        </div>

        <motion.button
          whileTap={{ scale: 0.94 }}
          animate={{ rotate: [0, 8, -8, 0] }}
          transition={{ duration: 0.4 }}
          className="relative rounded-xl p-2 text-slate-700 hover:bg-emerald-50"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500" />
        </motion.button>

        <div className="relative">
          <button
            className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700"
            onClick={() => setOpenProfile((v) => !v)}
          >
            <span className="max-w-28 truncate">{user?.displayName ?? "Guest"}</span>
            <ChevronDown className="h-4 w-4" />
          </button>
          <AnimatePresence>
            {openProfile && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="absolute right-0 mt-2 w-48 rounded-xl bg-white p-2 shadow-lg ring-1 ring-slate-200"
              >
                <button
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => void logout()}
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};
