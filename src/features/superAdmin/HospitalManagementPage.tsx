import { useMemo, useState } from "react";
import { Button, Switch, TextField } from "@mui/material";
import { subscribeCollection } from "../../services/firestoreService";
import { Doctor } from "../../types/models";
import { useEffect } from "react";

export const HospitalManagementPage = () => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [search, setSearch] = useState("");
  const [disabledHospitals, setDisabledHospitals] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const unsub = subscribeCollection("doctors", setDoctors);
    return unsub;
  }, []);

  const grouped = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const doctor of doctors) {
      const key = doctor.hospitalName || "Unknown Hospital";
      acc[key] = (acc[key] ?? 0) + 1;
    }
    return Object.entries(acc)
      .filter(([name]) => name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a[0].localeCompare(b[0]));
  }, [doctors, search]);

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <h2 className="mb-3 text-base font-semibold text-slate-800">Hospital Management</h2>
      <TextField size="small" fullWidth label="Search hospital" value={search} onChange={(event) => setSearch(event.target.value)} />
      <div className="mt-3 space-y-2">
        {grouped.map(([hospitalName, doctorCount]) => (
          <article key={hospitalName} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800">{hospitalName}</p>
              <p className="text-xs text-slate-500">Doctors: {doctorCount}</p>
            </div>
            <Switch
              checked={!disabledHospitals[hospitalName]}
              onChange={() => setDisabledHospitals((current) => ({ ...current, [hospitalName]: !current[hospitalName] }))}
            />
            <Button variant="outlined" size="small">Manage</Button>
          </article>
        ))}
      </div>
    </section>
  );
};
