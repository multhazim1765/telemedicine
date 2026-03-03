import { Button, TextField } from "@mui/material";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { subscribeCollection, updateDocumentById } from "../../services/firestoreService";
import { Patient } from "../../types/models";
import { useToast } from "../../components/ui/ToastProvider";

export const PatientManagementPage = () => {
  const { pushToast } = useToast();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Patient>>({});

  useEffect(() => {
    const unsub = subscribeCollection("patients", setPatients);
    return unsub;
  }, []);

  const onStartEdit = (patient: Patient) => {
    setEditingId(patient.id);
    setDraft(patient);
  };

  const onSave = async () => {
    if (!editingId) {
      return;
    }

    await updateDocumentById("patients", editingId, {
      name: draft.name,
      village: draft.village,
      phone: draft.phone
    });

    setEditingId(null);
    pushToast("Patient updated", "success");
  };

  return (
    <section className="rounded-2xl bg-white/80 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.08)] ring-1 ring-cyan-100 backdrop-blur-md">
      <h2 className="mb-3 text-base font-semibold text-slate-800">Patient Management</h2>

      <div className="space-y-2">
        {patients.map((patient) => {
          const editing = editingId === patient.id;
          return (
            <motion.div key={patient.id} layout className="grid gap-2 rounded-xl bg-slate-50 p-3 md:grid-cols-[1fr_1fr_1fr_auto]">
              <TextField size="small" value={editing ? draft.name ?? "" : patient.name} onChange={(event) => setDraft((v) => ({ ...v, name: event.target.value }))} disabled={!editing} />
              <TextField size="small" value={editing ? draft.village ?? "" : patient.village} onChange={(event) => setDraft((v) => ({ ...v, village: event.target.value }))} disabled={!editing} />
              <TextField size="small" value={editing ? draft.phone ?? "" : patient.phone} onChange={(event) => setDraft((v) => ({ ...v, phone: event.target.value }))} disabled={!editing} />
              {editing ? (
                <Button variant="contained" onClick={() => void onSave()}>Save</Button>
              ) : (
                <Button variant="outlined" onClick={() => onStartEdit(patient)}>Edit</Button>
              )}
            </motion.div>
          );
        })}
      </div>
    </section>
  );
};
