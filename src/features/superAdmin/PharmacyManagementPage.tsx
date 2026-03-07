import { Button, TextField } from "@mui/material";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { deleteDocumentById, setDocumentById, subscribeCollection } from "../../services/firestoreService";
import { AppUser } from "../../types/models";
import { useToast } from "../../components/ui/ToastProvider";
import { addDemoUser, deleteDemoUser, upsertDemoUserByUid } from "../../services/authService";
import { isFirebaseConfigured } from "../../services/firebase";
import { districts } from "../../constants/districts";

type PharmacyRow = AppUser & {
  pharmacyName: string;
  district: string;
};

export const PharmacyManagementPage = () => {
  const { pushToast } = useToast();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [search, setSearch] = useState("");
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<PharmacyRow>>({});
  const [newPharmacy, setNewPharmacy] = useState<{
    pharmacyName: string;
    district: string;
    phone: string;
    password: string;
  }>({
    pharmacyName: "",
    district: districts[0],
    phone: "",
    password: "am9790"
  });

  useEffect(() => {
    const unsubUsers = subscribeCollection("users", setUsers);
    return () => {
      unsubUsers();
    };
  }, []);

  const pharmacyRows = useMemo<PharmacyRow[]>(() => {
    return users
      .filter((user) => user.role === "pharmacy")
      .map((user) => ({
        ...user,
        pharmacyName: user.pharmacyName ?? user.displayName,
        district: user.district ?? "Unknown District"
      }))
      .filter((user) => {
        const normalizedSearch = search.trim().toLowerCase();
        if (!normalizedSearch) {
          return true;
        }

        return [user.displayName, user.pharmacyName, user.district, user.email, user.phone ?? ""]
          .some((value) => value.toLowerCase().includes(normalizedSearch));
      })
      .sort((a, b) => {
        const districtCompare = a.district.localeCompare(b.district);
        if (districtCompare !== 0) {
          return districtCompare;
        }
        return a.pharmacyName.localeCompare(b.pharmacyName);
      });
  }, [users, search]);

  const districtGroups = useMemo(() => {
    const grouped = new Map<string, PharmacyRow[]>();
    for (const pharmacy of pharmacyRows) {
      const key = pharmacy.district || "Unknown District";
      const list = grouped.get(key) ?? [];
      list.push(pharmacy);
      grouped.set(key, list);
    }

    return Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [pharmacyRows]);

  const onStartEdit = (pharmacy: PharmacyRow) => {
    setEditingUid(pharmacy.uid);
    setDraft(pharmacy);
  };

  const onAddPharmacy = async () => {
    try {
      if (isFirebaseConfigured) {
        throw new Error("Add pharmacy from dashboard is disabled in Firebase mode. Create Firebase Auth user first.");
      }
      if (!newPharmacy.pharmacyName.trim() || !newPharmacy.phone.trim()) {
        throw new Error("Pharmacy name and phone are required.");
      }

      const pharmacyName = newPharmacy.pharmacyName.trim();
      const district = newPharmacy.district || "Unknown District";
      const displayName = `${pharmacyName} Desk`;

      const createdUser = addDemoUser({
        email: "",
        password: newPharmacy.password,
        displayName,
        role: "pharmacy",
        phone: newPharmacy.phone.trim(),
        pharmacyName,
        district
      });

      await setDocumentById("users", createdUser.uid, {
        id: createdUser.uid,
        uid: createdUser.uid,
        email: createdUser.email,
        role: "pharmacy",
        displayName,
        phone: createdUser.phone ?? "",
        pharmacyName,
        district
      });

      setNewPharmacy({
        pharmacyName: "",
        district: districts[0],
        phone: "",
        password: "am9790"
      });
      pushToast("Pharmacy added", "success");
    } catch (error) {
      pushToast((error as Error).message, "error");
    }
  };

  const onSave = async () => {
    if (!editingUid) {
      return;
    }

    try {
      const pharmacyName = draft.pharmacyName?.trim() ?? "";
      if (!pharmacyName) {
        throw new Error("Pharmacy name is required.");
      }

      const district = draft.district?.trim() || "Unknown District";
      const displayName = draft.displayName?.trim() || `${pharmacyName} Desk`;

      await setDocumentById("users", editingUid, {
        id: editingUid,
        uid: editingUid,
        role: "pharmacy",
        displayName,
        phone: draft.phone ?? "",
        email: draft.email ?? "",
        pharmacyName,
        district
      });

      if (!isFirebaseConfigured) {
        const synced = upsertDemoUserByUid(editingUid, {
          displayName,
          role: "pharmacy",
          phone: draft.phone ?? "",
          email: draft.email ?? "",
          pharmacyName,
          district
        });

        await setDocumentById("users", editingUid, {
          id: editingUid,
          uid: editingUid,
          role: "pharmacy",
          displayName: synced.displayName,
          phone: synced.phone ?? "",
          email: synced.email,
          pharmacyName,
          district
        });
      }

      setEditingUid(null);
      setDraft({});
      pushToast("Pharmacy updated", "success");
    } catch (error) {
      pushToast((error as Error).message, "error");
    }
  };

  const onDelete = async (uid: string) => {
    try {
      if (isFirebaseConfigured) {
        throw new Error("Delete pharmacy from dashboard is disabled in Firebase mode. Remove Firebase Auth user first.");
      }

      await deleteDocumentById("users", uid);
      deleteDemoUser(uid);
      pushToast("Pharmacy removed", "info");
    } catch (error) {
      pushToast((error as Error).message, "error");
    }
  };

  return (
    <section className="rounded-2xl bg-white/80 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.08)] ring-1 ring-cyan-100 backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-800">Pharmacy Management</h2>
        <TextField
          size="small"
          label="Search pharmacies"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="mb-3 grid gap-2 rounded-xl bg-slate-50 p-3 md:grid-cols-[1.4fr_1fr_1fr_140px_auto]">
        <TextField size="small" label="Pharmacy name" value={newPharmacy.pharmacyName} onChange={(event) => setNewPharmacy((current) => ({ ...current, pharmacyName: event.target.value }))} />
        <TextField
          size="small"
          select
          SelectProps={{ native: true }}
          label="District"
          value={newPharmacy.district}
          onChange={(event) => setNewPharmacy((current) => ({ ...current, district: event.target.value }))}
        >
          {districts.map((districtOption) => (
            <option key={districtOption} value={districtOption}>
              {districtOption}
            </option>
          ))}
        </TextField>
        <TextField size="small" label="Phone" value={newPharmacy.phone} onChange={(event) => setNewPharmacy((current) => ({ ...current, phone: event.target.value }))} />
        <TextField size="small" label="Password" value={newPharmacy.password} onChange={(event) => setNewPharmacy((current) => ({ ...current, password: event.target.value }))} />
        <Button variant="contained" onClick={() => void onAddPharmacy()}>Add Pharmacy</Button>
      </div>

      <div className="space-y-3">
        {districtGroups.map(([district, pharmacies]) => (
          <div key={district} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">{district}</h3>
              <span className="text-xs text-slate-500">{pharmacies.length} pharmacies</span>
            </div>
            <div className="space-y-2">
              {pharmacies.map((pharmacy) => {
                const isEditing = editingUid === pharmacy.uid;
                return (
                  <motion.div key={pharmacy.uid} layout className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                    {isEditing ? (
                      <div className="grid gap-2 md:grid-cols-[1.2fr_1fr_1fr_1fr_auto_auto]">
                        <TextField size="small" label="Pharmacy name" value={draft.pharmacyName ?? ""} onChange={(event) => setDraft((current) => ({ ...current, pharmacyName: event.target.value }))} />
                        <TextField
                          size="small"
                          select
                          SelectProps={{ native: true }}
                          label="District"
                          value={draft.district ?? districts[0]}
                          onChange={(event) => setDraft((current) => ({ ...current, district: event.target.value }))}
                        >
                          {districts.map((districtOption) => (
                            <option key={districtOption} value={districtOption}>
                              {districtOption}
                            </option>
                          ))}
                        </TextField>
                        <TextField size="small" label="Display name" value={draft.displayName ?? ""} onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))} />
                        <TextField size="small" label="Phone" value={draft.phone ?? ""} onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))} />
                        <Button variant="contained" onClick={() => void onSave()}>Save</Button>
                        <Button variant="outlined" onClick={() => { setEditingUid(null); setDraft({}); }}>Cancel</Button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-800">{pharmacy.pharmacyName}</p>
                          <p className="text-xs text-slate-500">{pharmacy.displayName}</p>
                          <p className="text-xs text-slate-500">{pharmacy.email}</p>
                          {pharmacy.phone && <p className="text-xs text-slate-500">{pharmacy.phone}</p>}
                        </div>
                        <Button variant="outlined" onClick={() => onStartEdit(pharmacy)}>Edit</Button>
                        <Button color="error" onClick={() => void onDelete(pharmacy.uid)}>Delete</Button>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}
        {districtGroups.length === 0 && (
          <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600 ring-1 ring-slate-200">No pharmacies found.</p>
        )}
      </div>
    </section>
  );
};