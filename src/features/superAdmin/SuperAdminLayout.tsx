import { Outlet } from "react-router-dom";
import { DashboardLayout } from "../../components/DashboardLayout";

export const SuperAdminLayout = () => {
  return (
    <DashboardLayout title="Super Admin Dashboard">
      <Outlet />
    </DashboardLayout>
  );
};
