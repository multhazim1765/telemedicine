import { ReactNode } from "react";
import { DashboardShell } from "./layout/DashboardShell";

interface DashboardLayoutProps {
  title: string;
  children: ReactNode;
}

export const DashboardLayout = ({ title, children }: DashboardLayoutProps) => {
  return (
    <DashboardShell title={title}>{children}</DashboardShell>
  );
};
