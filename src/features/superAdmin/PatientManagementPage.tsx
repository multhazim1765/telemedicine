import { Button, TextField } from "@mui/material";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { deleteDocumentById, setDocumentById, subscribeCollection } from "../../services/firestoreService";
import { AppUser, Patient } from "../../types/models";
import { useToast } from "../../components/ui/ToastProvider";
import { addDemoUser, deleteDemoUser, upsertDemoUserByUid } from "../../services/authService";
import { isFirebaseConfigured } from "../../services/firebase";
import { nowIso } from "../../utils/date";
import { districts } from "../../constants/districts";

type PatientRow = Omit<Patient, "district"> & { district: string; uid: string };

export const PatientManagementPage = () => {
  const { pushToast } = useToast();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<PatientRow>>({});
  const [newPatient, setNewPatient] = useState<{
    name: string;
    district: string;
    phone: string;
    age: number;
    gender: "male" | "female" | "other";
    password: string;
  }>({
    name: "",
    district: districts[0],
    phone: "",
    age: 25,
    gender: "other" as "male" | "female" | "other",
    password: "demo123"
  });

  useEffect(() => {
    const unsubPatients = subscribeCollection("patients", setPatients);
    const unsubUsers = subscribeCollection("users", setUsers);
    return () => {
      unsubPatients();
      unsubUsers();
    };
  }, []);

  const patientRows = useMemo<PatientRow[]>(() => {
    const patientByUid = new Map<string, Patient>();
    for (const patient of patients) {
      patientByUid.set(patient.userId || patient.id, patient);
    }

    const rows: PatientRow[] = users
      .filter((user) => user.role === "patient")
      .map((user) => {
        const linked = patientByUid.get(user.uid);
        return {
          id: linked?.id ?? user.uid,
          uid: user.uid,
          userId: user.uid,
          name: linked?.name ?? user.displayName,
          age: linked?.age ?? 25,
          gender: linked?.gender ?? "other",
          district: linked?.district ?? linked?.village ?? "Unknown District",
          village: linked?.village,
          phone: linked?.phone ?? user.phone ?? "",
          createdAt: linked?.createdAt ?? nowIso()
        };
      });

    for (const patient of patients) {
      const uid = patient.userId || patient.id;
      if (rows.some((row) => row.uid === uid)) {
        continue;
      }
      rows.push({
        ...patient,
        district: patient.district ?? patient.village ?? "Unknown District",
        uid
      });
    }

    return rows.sort((a, b) => {
      const districtCompare = a.district.localeCompare(b.district);
      if (districtCompare !== 0) {
        return districtCompare;
      }
      return a.name.localeCompare(b.name);
    });
  }, [patients, users]);

  const districtGroups = useMemo(() => {
    const grouped = new Map<string, PatientRow[]>();
    for (const patient of patientRows) {
      const key = patient.district || "Unknown District";
      const list = grouped.get(key) ?? [];
      list.push(patient);
      grouped.set(key, list);
    }

    return Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [patientRows]);

  const onStartEdit = (patient: PatientRow) => {
    setEditingId(patient.uid);
    setDraft(patient);
  };

  const onAddPatient = async () => {
    try {
      if (isFirebaseConfigured) {
        throw new Error("Add patient from dashboard is disabled in Firebase mode. Create Firebase Auth user first.");
      }
      if (!newPatient.name.trim() || !newPatient.phone.trim()) {
        throw new Error("Patient name and phone are required.");
      }

      const createdUser = addDemoUser({
        email: "",
        password: newPatient.password,
        displayName: newPatient.name.trim(),
        role: "patient",
        phone: newPatient.phone.trim()
      });

      await setDocumentById("users", createdUser.uid, {
        id: createdUser.uid,
        uid: createdUser.uid,
        email: createdUser.email,
        role: "patient",
        displayName: createdUser.displayName,
        phone: createdUser.phone ?? ""
      });

      await setDocumentById("patients", createdUser.uid, {
        id: createdUser.uid,
        userId: createdUser.uid,
        name: newPatient.name.trim(),
        district: newPatient.district || "Unknown District",
        village: newPatient.district || "Unknown District",
        age: Number(newPatient.age) || 25,
        gender: newPatient.gender,
        phone: newPatient.phone.trim(),
        createdAt: nowIso()
      });

      setNewPatient({
        name: "",
        district: districts[0],
        phone: "",
        age: 25,
        gender: "other",
        password: "demo123"
      });
      pushToast("Patient added", "success");
    } catch (error) {
      pushToast((error as Error).message, "error");
    }
  };

  const onSave = async () => {
    if (!editingId) {
      return;
    }

    try {
      await setDocumentById("patients", editingId, {
        id: editingId,
        userId: editingId,
        name: draft.name ?? "",
        district: draft.district ?? draft.village ?? "Unknown District",
        village: draft.village ?? draft.district ?? "Unknown District",
        age: Number(draft.age) || 25,
        gender: (draft.gender as "male" | "female" | "other") ?? "other",
        phone: draft.phone ?? "",
        createdAt: draft.createdAt ?? nowIso()
      });

      await setDocumentById("users", editingId, {
        id: editingId,
        uid: editingId,
        role: "patient",
        displayName: draft.name ?? "",
        phone: draft.phone ?? ""
      });

      if (!isFirebaseConfigured) {
        const synced = upsertDemoUserByUid(editingId, {
          displayName: draft.name ?? "",
          phone: draft.phone ?? "",
          role: "patient"
        });
        await setDocumentById("users", editingId, {
          id: editingId,
          uid: editingId,
          role: "patient",
          displayName: synced.displayName,
          phone: synced.phone ?? "",
          email: synced.email
        });
      }

      setEditingId(null);
      pushToast("Patient updated", "success");
    } catch (error) {
      pushToast((error as Error).message, "error");
    }
  };

  const onDelete = async (uid: string) => {
    try {
      if (isFirebaseConfigured) {
        throw new Error("Delete patient from dashboard is disabled in Firebase mode. Remove Firebase Auth user first.");
      }

      await deleteDocumentById("patients", uid);
      await deleteDocumentById("users", uid);
      deleteDemoUser(uid);
      pushToast("Patient removed", "info");
    } catch (error) {
      pushToast((error as Error).message, "error");
    }
  };

  return (
    <section className="rounded-2xl bg-white/80 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.08)] ring-1 ring-cyan-100 backdrop-blur-md">
      <h2 className="mb-3 text-base font-semibold text-slate-800">Patient Management</h2>

      <div className="mb-3 grid gap-2 rounded-xl bg-slate-50 p-3 md:grid-cols-[1fr_1fr_1fr_120px_120px_auto]">
        <TextField size="small" label="Name" value={newPatient.name} onChange={(event) => setNewPatient((current) => ({ ...current, name: event.target.value }))} />
        <TextField
          size="small"
          select
          SelectProps={{ native: true }}
          label="District"
          value={newPatient.district}
          onChange={(event) => setNewPatient((current) => ({ ...current, district: event.target.value }))}
        >
          {districts.map((districtOption) => (
            <option key={districtOption} value={districtOption}>
              {districtOption}
            </option>
          ))}
        </TextField>
        <TextField size="small" label="Phone" value={newPatient.phone} onChange={(event) => setNewPatient((current) => ({ ...current, phone: event.target.value }))} />
        <TextField size="small" label="Age" type="number" inputProps={{ min: 1, max: 120 }} value={newPatient.age} onChange={(event) => setNewPatient((current) => ({ ...current, age: Number(event.target.value) || 25 }))} />
        <TextField
          size="small"
          select
          SelectProps={{ native: true }}
          label="Gender"
          value={newPatient.gender}
          onChange={(event) => setNewPatient((current) => ({ ...current, gender: event.target.value as "male" | "female" | "other" }))}
        >
          <option value="male">male</option>
          <option value="female">female</option>
          <option value="other">other</option>
        </TextField>
        <Button variant="contained" onClick={() => void onAddPatient()}>Add Patient</Button>
      </div>

      <div className="space-y-2">
        {districtGroups.map(([districtName, districtPatients]) => (
          <div key={districtName} className="space-y-2 rounded-xl bg-slate-100/60 p-3 ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">{districtName}</h3>
              <p className="text-xs text-slate-600">{districtPatients.length} patients</p>
            </div>
            {districtPatients.map((patient) => {
              const editing = editingId === patient.uid;
              return (
                <motion.div key={patient.uid} layout className="grid gap-2 rounded-xl bg-white p-3 md:grid-cols-[1fr_1fr_1fr_120px_120px_auto_auto]">
                  <TextField size="small" value={editing ? draft.name ?? "" : patient.name} onChange={(event) => setDraft((v) => ({ ...v, name: event.target.value }))} disabled={!editing} />
                  <TextField
                    size="small"
                    select
                    SelectProps={{ native: true }}
                    value={editing ? draft.district ?? patient.district : patient.district}
                    onChange={(event) => setDraft((v) => ({ ...v, district: event.target.value }))}
                    disabled={!editing}
                  >
                    {districts.map((districtOption) => (
                      <option key={districtOption} value={districtOption}>
                        {districtOption}
                      </option>
                    ))}
                  </TextField>
                  <TextField size="small" value={editing ? draft.phone ?? "" : patient.phone} onChange={(event) => setDraft((v) => ({ ...v, phone: event.target.value }))} disabled={!editing} />
                  <TextField size="small" type="number" value={editing ? draft.age ?? 25 : patient.age} onChange={(event) => setDraft((v) => ({ ...v, age: Number(event.target.value) || 25 }))} disabled={!editing} />
                  <TextField
                    size="small"
                    select
                    SelectProps={{ native: true }}
                    value={editing ? draft.gender ?? "other" : patient.gender}
                    onChange={(event) => setDraft((v) => ({ ...v, gender: event.target.value as "male" | "female" | "other" }))}
                    disabled={!editing}
                  >
                    <option value="male">male</option>
                    <option value="female">female</option>
                    <option value="other">other</option>
                  </TextField>
                  {editing ? (
                    <Button variant="contained" onClick={() => void onSave()}>Save</Button>
                  ) : (
                    <Button variant="outlined" onClick={() => onStartEdit(patient)}>Edit</Button>
                  )}
                  <Button color="error" variant="outlined" onClick={() => void onDelete(patient.uid)}>Delete</Button>
                </motion.div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
};
