import { Button, FormControlLabel, Switch, TextField } from "@mui/material";
import { useState } from "react";

export const SystemSettingsPage = () => {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [supportEmail, setSupportEmail] = useState("support@telehealth.local");

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <h2 className="mb-3 text-base font-semibold text-slate-800">System Settings</h2>
      <div className="space-y-3">
        <FormControlLabel
          control={<Switch checked={maintenanceMode} onChange={(event) => setMaintenanceMode(event.target.checked)} />}
          label="Maintenance mode"
        />
        <TextField size="small" fullWidth label="Support Email" value={supportEmail} onChange={(event) => setSupportEmail(event.target.value)} />
        <Button variant="contained">Save Settings</Button>
      </div>
      <p className="mt-3 text-xs text-slate-500">Frontend-only settings surface; server behavior remains unchanged.</p>
    </section>
  );
};
