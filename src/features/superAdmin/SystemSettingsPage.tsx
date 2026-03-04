import { Button, FormControlLabel, Switch, TextField } from "@mui/material";
import { useEffect, useState } from "react";
import { useToast } from "../../components/ui/ToastProvider";
import { loadAdminPreferences, saveAdminPreferences } from "./adminPreferences";
import { useBusinessDate } from "../../hooks/useBusinessDate";
import { getSystemDate, moveBusinessDateByDays, resetBusinessDateToSystem, setBusinessDate } from "../../services/businessDateService";

export const SystemSettingsPage = () => {
  const { pushToast } = useToast();
  const businessDate = useBusinessDate();
  const initialPreferences = loadAdminPreferences();
  const [maintenanceMode, setMaintenanceMode] = useState(initialPreferences.maintenanceMode);
  const [supportEmail, setSupportEmail] = useState(initialPreferences.supportEmail);
  const [dateInput, setDateInput] = useState(businessDate);

  useEffect(() => {
    setDateInput(businessDate);
  }, [businessDate]);

  const onSave = () => {
    if (!supportEmail.trim() || !supportEmail.includes("@")) {
      pushToast("Enter a valid support email", "error");
      return;
    }

    const current = loadAdminPreferences();
    saveAdminPreferences({
      ...current,
      maintenanceMode,
      supportEmail: supportEmail.trim()
    });
    pushToast("System settings saved", "success");
  };

  const onApplyDate = () => {
    try {
      setBusinessDate(dateInput);
      pushToast(`Working date set to ${dateInput}`, "success");
    } catch (error) {
      pushToast((error as Error).message, "error");
    }
  };

  const onMoveNextDate = () => {
    try {
      const next = moveBusinessDateByDays(1);
      setDateInput(next);
      pushToast(`System day reset to ${next}`, "info");
    } catch (error) {
      pushToast((error as Error).message, "error");
    }
  };

  const onResetToToday = () => {
    const today = resetBusinessDateToSystem();
    setDateInput(today);
    pushToast("Working date reset to system date", "info");
  };

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <h2 className="mb-3 text-base font-semibold text-slate-800">System Settings</h2>
      <div className="space-y-3">
        <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
          <p className="text-sm font-semibold text-slate-800">Working Date Control</p>
          <p className="mt-1 text-xs text-slate-600">Current working date: {businessDate} (System date: {getSystemDate()})</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
            <TextField
              size="small"
              type="date"
              label="Working Date"
              InputLabelProps={{ shrink: true }}
              value={dateInput}
              onChange={(event) => setDateInput(event.target.value)}
            />
            <Button variant="outlined" onClick={onApplyDate}>Apply Date</Button>
            <Button variant="contained" onClick={onMoveNextDate}>Next Date Reset</Button>
            <Button variant="text" onClick={onResetToToday}>Use System Date</Button>
          </div>
        </div>

        <FormControlLabel
          control={<Switch checked={maintenanceMode} onChange={(event) => setMaintenanceMode(event.target.checked)} />}
          label="Maintenance mode"
        />
        <TextField size="small" fullWidth label="Support Email" value={supportEmail} onChange={(event) => setSupportEmail(event.target.value)} />
        <Button variant="contained" onClick={onSave}>Save Settings</Button>
      </div>
      <p className="mt-3 text-xs text-slate-500">Settings are saved locally for super admin workflow continuity.</p>
    </section>
  );
};
