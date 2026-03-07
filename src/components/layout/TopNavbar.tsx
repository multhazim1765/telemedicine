import { AnimatePresence, motion } from "framer-motion";
import { Bell, ChevronDown, LogOut, Menu, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { logout } from "../../services/authService";
import { AppUser } from "../../types/models";
import { useBusinessDate } from "../../hooks/useBusinessDate";

interface TopNavbarProps {
  title: string;
  user: AppUser | null;
  onToggleSidebar: () => void;
  onToggleMobileSidebar: () => void;
}

export const TopNavbar = ({ title, user, onToggleSidebar, onToggleMobileSidebar }: TopNavbarProps) => {
  const businessDate = useBusinessDate();
  const [openProfile, setOpenProfile] = useState(false);
  const [openNotifications, setOpenNotifications] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const notificationsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (profileRef.current && !profileRef.current.contains(target)) {
        setOpenProfile(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(target)) {
        setOpenNotifications(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  return (
    <header className="sticky top-3 z-30 mb-4 rounded-[1.7rem] bg-[#fffdf9] px-4 py-3 shadow-[0_18px_38px_rgba(70,49,35,0.08)] ring-1 ring-[#e8dccd]">
      <div className="flex items-center gap-2">
        <button type="button" className="btn-muted lg:hidden" onClick={onToggleMobileSidebar}>
          <Menu className="h-4 w-4" />
        </button>
        <button type="button" className="btn-muted hidden lg:inline-flex" onClick={onToggleSidebar}>Toggle</button>
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[#a27944]">Care desk</p>
          <h1 className="font-[Georgia] text-xl font-semibold text-[#32251b]">{title}</h1>
        </div>
        <span className="rounded-full bg-[#faf3e6] px-3 py-1 text-xs font-medium text-[#7a5f44] ring-1 ring-[#eadac6]">
          Date: {businessDate}
        </span>

        <div className="mx-auto hidden max-w-sm flex-1 items-center gap-2 rounded-full bg-[#fbf7f1] px-3 py-2 ring-1 ring-[#eadac6] md:flex">
          <Search className="h-4 w-4 text-[#8d7b6b]" />
          <input
            className="w-full bg-transparent text-sm text-[#32251b] outline-none placeholder:text-[#9a8878]"
            placeholder="Search patients, appointments..."
          />
        </div>

        <div className="relative" ref={notificationsRef}>
          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            animate={{ rotate: [0, 8, -8, 0] }}
            transition={{ duration: 0.4 }}
            className="relative rounded-xl p-2 text-[#6d584a] hover:bg-[#faf3ea]"
            onClick={() => setOpenNotifications((value) => !value)}
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500" />
          </motion.button>
          <AnimatePresence>
            {openNotifications && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="absolute right-0 z-50 mt-2 w-64 rounded-xl bg-[#fffdf9] p-2 shadow-lg ring-1 ring-[#e8dccd]"
              >
                <p className="rounded-lg px-3 py-2 text-sm text-[#6d584a]">No new notifications.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="relative" ref={profileRef}>
          <button
            type="button"
            className="flex items-center gap-2 rounded-full bg-[#fbf7f1] px-3 py-2 text-sm text-[#32251b] ring-1 ring-[#eadac6]"
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
                className="absolute right-0 z-50 mt-2 w-48 rounded-xl bg-[#fffdf9] p-2 shadow-lg ring-1 ring-[#e8dccd]"
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[#32251b] hover:bg-[#faf3ea]"
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
