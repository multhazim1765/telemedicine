import { useEffect, useMemo, useState } from "react";
import { Button, Drawer, Switch, TextField } from "@mui/material";
import { deleteDocumentById, setDocumentById, subscribeCollection } from "../../services/firestoreService";
import { AppUser, Appointment, Doctor, HospitalCatalog } from "../../types/models";
import { loadAdminPreferences, saveAdminPreferences } from "./adminPreferences";
import { useToast } from "../../components/ui/ToastProvider";
import { useBusinessDate } from "../../hooks/useBusinessDate";
import { BusinessDateBadge } from "../../components/ui/BusinessDateBadge";
import { districts } from "../../constants/districts";
import { useHospitalCatalog } from "../../hooks/useHospitalCatalog";
import { createHospitalCatalogId } from "../../utils/hospitalCatalog";

type DistrictHospitalGroup = {
  district: string;
  hospitals: Array<{
    id: string;
    hospitalName: string;
    district: string;
    doctorCount: number;
  }>;
};

export const HospitalManagementPage = () => {
  const { pushToast } = useToast();
  const businessDate = useBusinessDate();
  const hospitalCatalog = useHospitalCatalog();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [search, setSearch] = useState("");
  const [disabledHospitals, setDisabledHospitals] = useState<Record<string, boolean>>(() => loadAdminPreferences().disabledHospitals);
  const [managingHospitalId, setManagingHospitalId] = useState<string | null>(null);
  const [editingHospitalId, setEditingHospitalId] = useState<string | null>(null);
  const [editingHospitalName, setEditingHospitalName] = useState("");
  const [editingHospitalDistrict, setEditingHospitalDistrict] = useState<string>(districts[0] ?? "");
  const [newHospitalName, setNewHospitalName] = useState("");
  const [newHospitalDistrict, setNewHospitalDistrict] = useState<string>(districts[0] ?? "");
  const [draftByDoctorId, setDraftByDoctorId] = useState<Record<string, Doctor>>({});
  const [slotInputByDoctorId, setSlotInputByDoctorId] = useState<Record<string, string>>({});
  const [newDoctor, setNewDoctor] = useState({
    doctorCode: "",
    name: "",
    designation: "Physician",
    specialization: "general",
    place: "",
    district: "",
    availabilitySlots: "Morning, Afternoon"
  });

  useEffect(() => {
    const unsubDoctors = subscribeCollection("doctors", setDoctors);
    const unsubAppointments = subscribeCollection("appointments", setAppointments);
    const unsubUsers = subscribeCollection("users", setUsers);
    return () => {
      unsubDoctors();
      unsubAppointments();
      unsubUsers();
    };
  }, []);

  const managingHospital = useMemo(
    () => hospitalCatalog.find((item) => item.id === managingHospitalId) ?? null,
    [hospitalCatalog, managingHospitalId]
  );

  useEffect(() => {
    if (!managingHospitalId) {
      return;
    }
    const stillExists = hospitalCatalog.some((item) => item.id === managingHospitalId);
    if (!stillExists) {
      setManagingHospitalId(null);
    }
  }, [hospitalCatalog, managingHospitalId]);

  const districtGroups = useMemo<DistrictHospitalGroup[]>(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const doctorCountByHospital = doctors.reduce<Record<string, number>>((acc, doctor) => {
      const hospitalName = doctor.hospitalName?.trim() || "Unknown Hospital";
      acc[hospitalName] = (acc[hospitalName] ?? 0) + 1;
      return acc;
    }, {});

    const districtToHospitals = new Map<string, DistrictHospitalGroup["hospitals"]>();
    for (const district of districts) {
      districtToHospitals.set(district, []);
    }

    hospitalCatalog
      .map((entry) => ({
        id: entry.id,
        hospitalName: entry.hospitalName,
        district: entry.district,
        doctorCount: doctorCountByHospital[entry.hospitalName] ?? 0
      }))
      .filter(({ hospitalName, district }) => {
        if (!normalizedSearch) {
          return true;
        }
        return `${hospitalName} ${district}`.toLowerCase().includes(normalizedSearch);
      })
      .sort((a, b) => a.hospitalName.localeCompare(b.hospitalName))
      .forEach((entry) => {
        const key = districtToHospitals.has(entry.district) ? entry.district : "Other";
        if (!districtToHospitals.has(key)) {
          districtToHospitals.set(key, []);
        }
        districtToHospitals.get(key)?.push(entry);
      });

    return Array.from(districtToHospitals.entries())
      .map(([district, hospitals]) => ({ district, hospitals }))
      .filter((group) => {
        if (!normalizedSearch) {
          return true;
        }
        return group.hospitals.length > 0 || group.district.toLowerCase().includes(normalizedSearch);
      });
  }, [doctors, hospitalCatalog, search]);

  const doctorsInManagedHospital = useMemo(
    () => doctors.filter((doctor) => doctor.hospitalName === managingHospital?.hospitalName),
    [doctors, managingHospital?.hospitalName]
  );

  const managedDoctorIds = useMemo(
    () => new Set(doctorsInManagedHospital.map((doctor) => doctor.id)),
    [doctorsInManagedHospital]
  );

  const managedAppointments = useMemo(
    () => appointments.filter((appointment) => managedDoctorIds.has(appointment.doctorId)),
    [appointments, managedDoctorIds]
  );

  const appointmentSlotSummary = useMemo(() => {
    const slotCount = managedAppointments.reduce<Record<string, number>>((acc, appointment) => {
      const key = appointment.slot || "Unknown";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    return Object.entries(slotCount)
      .map(([slot, count]) => ({ slot, count }))
      .sort((a, b) => a.slot.localeCompare(b.slot));
  }, [managedAppointments]);

  const configuredHospitalSlots = useMemo(() => {
    return Array.from(new Set(doctorsInManagedHospital.flatMap((doctor) => doctor.availabilitySlots ?? []))).sort((a, b) => a.localeCompare(b));
  }, [doctorsInManagedHospital]);

  const visibleHospitalCount = useMemo(
    () => districtGroups.reduce((sum, group) => sum + group.hospitals.length, 0),
    [districtGroups]
  );

  const onToggleHospital = (hospitalName: string) => {
    setDisabledHospitals((current) => {
      const next = { ...current, [hospitalName]: !current[hospitalName] };
      const preferences = loadAdminPreferences();
      saveAdminPreferences({
        ...preferences,
        disabledHospitals: next
      });

      pushToast(next[hospitalName] ? `${hospitalName} marked inactive` : `${hospitalName} marked active`, "info");
      return next;
    });
  };

  const onOpenManage = (entry: HospitalCatalog) => {
    setManagingHospitalId(entry.id);
    setDraftByDoctorId({});
    setSlotInputByDoctorId({});
    setNewDoctor((state) => ({
      ...state,
      district: entry.district,
      place: state.place || entry.district
    }));
  };

  const onStartEditHospital = (entry: HospitalCatalog) => {
    setEditingHospitalId(entry.id);
    setEditingHospitalName(entry.hospitalName);
    setEditingHospitalDistrict(entry.district);
  };

  const onCancelEditHospital = () => {
    setEditingHospitalId(null);
    setEditingHospitalName("");
    setEditingHospitalDistrict(districts[0] ?? "");
  };

  const syncDisabledHospitalName = (oldHospitalName: string, nextHospitalName: string) => {
    setDisabledHospitals((current) => {
      if (oldHospitalName === nextHospitalName || !(oldHospitalName in current)) {
        return current;
      }

      const next = { ...current };
      const currentStatus = next[oldHospitalName];
      delete next[oldHospitalName];
      next[nextHospitalName] = currentStatus;
      const preferences = loadAdminPreferences();
      saveAdminPreferences({
        ...preferences,
        disabledHospitals: next
      });
      return next;
    });
  };

  const onAddHospital = async () => {
    try {
      const hospitalName = newHospitalName.trim();
      if (!hospitalName) {
        throw new Error("Hospital name is required.");
      }

      const exists = hospitalCatalog.some(
        (item) => item.hospitalName.toLowerCase() === hospitalName.toLowerCase()
      );
      if (exists) {
        throw new Error("Hospital already exists.");
      }

      const district = newHospitalDistrict || districts[0] || "Unknown District";
      const id = createHospitalCatalogId(hospitalName, district);
      await setDocumentById("hospital_catalog", id, {
        id,
        hospitalName,
        district
      });

      setNewHospitalName("");
      pushToast("Hospital added", "success");
    } catch (error) {
      pushToast((error as Error).message, "error");
    }
  };

  const onSaveHospitalEdit = async () => {
    if (!editingHospitalId) {
      return;
    }

    try {
      const existing = hospitalCatalog.find((item) => item.id === editingHospitalId);
      if (!existing) {
        throw new Error("Hospital not found.");
      }

      const nextHospitalName = editingHospitalName.trim();
      const nextDistrict = editingHospitalDistrict.trim() || existing.district;

      if (!nextHospitalName) {
        throw new Error("Hospital name is required.");
      }

      const duplicate = hospitalCatalog.some(
        (item) => item.id !== editingHospitalId && item.hospitalName.toLowerCase() === nextHospitalName.toLowerCase()
      );
      if (duplicate) {
        throw new Error("Another hospital already uses this name.");
      }

      await setDocumentById("hospital_catalog", editingHospitalId, {
        id: editingHospitalId,
        hospitalName: nextHospitalName,
        district: nextDistrict
      });

      const impactedDoctors = doctors.filter((doctor) => doctor.hospitalName === existing.hospitalName);
      await Promise.all(
        impactedDoctors.map((doctor) =>
          setDocumentById("doctors", doctor.id, {
            ...doctor,
            hospitalName: nextHospitalName,
            district: nextDistrict,
            place: nextDistrict,
            city: nextDistrict
          })
        )
      );

      const impactedUsers = users.filter((user) => user.role === "doctor" && user.hospitalName === existing.hospitalName);
      await Promise.all(
        impactedUsers.map((user) =>
          setDocumentById("users", user.uid, {
            ...user,
            hospitalName: nextHospitalName
          })
        )
      );

      syncDisabledHospitalName(existing.hospitalName, nextHospitalName);
      onCancelEditHospital();
      pushToast("Hospital updated", "success");
    } catch (error) {
      pushToast((error as Error).message, "error");
    }
  };

  const onRemoveHospital = async (entry: HospitalCatalog) => {
    const confirmed = window.confirm(`Remove hospital '${entry.hospitalName}' from ${entry.district}? This will also remove its doctors and appointments.`);
    if (!confirmed) {
      return;
    }

    try {
      const impactedDoctors = doctors.filter((doctor) => doctor.hospitalName === entry.hospitalName);
      const impactedDoctorIds = new Set(impactedDoctors.map((doctor) => doctor.id));
      const impactedAppointments = appointments.filter((appointment) => impactedDoctorIds.has(appointment.doctorId));

      const impactedDoctorUsers = users.filter(
        (user) => user.role === "doctor" && impactedDoctors.some((doctor) => doctor.userId === user.uid)
      );

      await Promise.all([
        ...impactedDoctors.map((doctor) => deleteDocumentById("doctors", doctor.id)),
        ...impactedDoctorUsers.map((user) => deleteDocumentById("users", user.uid)),
        ...impactedAppointments.map((appointment) => deleteDocumentById("appointments", appointment.id)),
        deleteDocumentById("hospital_catalog", entry.id)
      ]);

      setDisabledHospitals((current) => {
        if (!(entry.hospitalName in current)) {
          return current;
        }
        const next = { ...current };
        delete next[entry.hospitalName];
        const preferences = loadAdminPreferences();
        saveAdminPreferences({
          ...preferences,
          disabledHospitals: next
        });
        return next;
      });

      if (managingHospitalId === entry.id) {
        setManagingHospitalId(null);
      }
      if (editingHospitalId === entry.id) {
        onCancelEditHospital();
      }

      pushToast(`Hospital removed. Doctors deleted: ${impactedDoctors.length}`, "info");
    } catch (error) {
      pushToast((error as Error).message, "error");
    }
  };

  const getDoctorDraft = (doctor: Doctor): Doctor => draftByDoctorId[doctor.id] ?? doctor;

  const onChangeDoctorField = (doctor: Doctor, field: keyof Doctor, value: string | string[]) => {
    const current = getDoctorDraft(doctor);
    setDraftByDoctorId((state) => ({
      ...state,
      [doctor.id]: {
        ...current,
        [field]: value
      }
    }));
  };

  const parseSlots = (value: string): string[] => {
    return value
      .split(",")
      .map((slot) => slot.trim())
      .filter(Boolean);
  };

  const onSaveDoctor = async (doctor: Doctor) => {
    if (!managingHospital) {
      return;
    }

    try {
      const draft = getDoctorDraft(doctor);
      const slotText = slotInputByDoctorId[doctor.id] ?? (draft.availabilitySlots ?? []).join(", ");
      const sanitizedSlots = parseSlots(slotText);
      const payload: Doctor = {
        ...doctor,
        ...draft,
        hospitalName: managingHospital.hospitalName,
        district: draft.district || managingHospital.district || draft.place,
        city: draft.city || draft.place,
        availabilitySlots: sanitizedSlots.length > 0 ? sanitizedSlots : ["Morning"]
      };

      await setDocumentById("doctors", doctor.id, payload);
      await setDocumentById("users", payload.userId, {
        uid: payload.userId,
        email: users.find((user) => user.uid === payload.userId)?.email ?? `${payload.userId}@hospital.local`,
        role: "doctor",
        displayName: payload.name,
        phone: payload.phone ?? users.find((user) => user.uid === payload.userId)?.phone ?? "",
        hospitalName: payload.hospitalName
      });
      setDraftByDoctorId((state) => {
        const next = { ...state };
        delete next[doctor.id];
        return next;
      });
      setSlotInputByDoctorId((state) => {
        const next = { ...state };
        delete next[doctor.id];
        return next;
      });
      pushToast("Doctor updated", "success");
    } catch (error) {
      pushToast((error as Error).message, "error");
    }
  };

  const onDeleteDoctor = async (doctorId: string) => {
    try {
      const doctor = doctors.find((item) => item.id === doctorId);
      await deleteDocumentById("doctors", doctorId);
      if (doctor?.userId) {
        await deleteDocumentById("users", doctor.userId);
      }
      pushToast("Doctor removed from hospital", "info");
    } catch (error) {
      pushToast((error as Error).message, "error");
    }
  };

  const onAddDoctor = async () => {
    if (!managingHospital) {
      return;
    }

    try {
      if (!newDoctor.name.trim()) {
        throw new Error("Doctor name is required.");
      }
      const generatedCode = newDoctor.doctorCode.trim() || `D${Date.now().toString().slice(-4)}`;
      let doctorId = generatedCode.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!doctorId) {
        doctorId = `d${Date.now().toString().slice(-6)}`;
      }

      const existingDoctorIds = new Set(doctors.map((doctor) => doctor.id));
      if (existingDoctorIds.has(doctorId)) {
        doctorId = `${doctorId}${Date.now().toString().slice(-3)}`;
      }
      const slotList = parseSlots(newDoctor.availabilitySlots);

      await setDocumentById("doctors", doctorId, {
        id: doctorId,
        userId: doctorId,
        doctorCode: generatedCode,
        name: newDoctor.name.trim(),
        hospitalName: managingHospital.hospitalName,
        place: newDoctor.place.trim() || managingHospital.district || "Unknown",
        district: newDoctor.district.trim() || managingHospital.district || newDoctor.place.trim() || "Unknown",
        designation: newDoctor.designation.trim() || "Physician",
        specialization: newDoctor.specialization || "general",
        availabilitySlots: slotList.length > 0 ? slotList : ["Morning"],
        city: newDoctor.place.trim() || managingHospital.district || "Unknown",
        phone: ""
      });

      await setDocumentById("users", doctorId, {
        uid: doctorId,
        email: `${doctorId}@hospital.local`,
        role: "doctor",
        displayName: newDoctor.name.trim(),
        phone: "",
        hospitalName: managingHospital.hospitalName
      });

      setNewDoctor({
        doctorCode: "",
        name: "",
        designation: "Physician",
        specialization: "general",
        place: "",
        district: managingHospital.district,
        availabilitySlots: "Morning, Afternoon"
      });
      pushToast("Doctor added", "success");
    } catch (error) {
      pushToast((error as Error).message, "error");
    }
  };

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <h2 className="mb-3 text-base font-semibold text-slate-800">Hospital Management</h2>
      <BusinessDateBadge />

      <div className="mb-3 mt-2 grid gap-2 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-3">
        <div>
          <p className="text-xs text-slate-500">Districts</p>
          <p className="font-semibold text-slate-800">{districts.length}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Hospitals (Catalog)</p>
          <p className="font-semibold text-slate-800">{hospitalCatalog.length}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Visible Hospitals</p>
          <p className="font-semibold text-slate-800">{visibleHospitalCount}</p>
        </div>
      </div>

      <div className="mb-3 grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1fr_1fr_auto]">
        <TextField
          size="small"
          label="New hospital name"
          value={newHospitalName}
          onChange={(event) => setNewHospitalName(event.target.value)}
        />
        <TextField
          select
          size="small"
          label="District"
          value={newHospitalDistrict}
          onChange={(event) => setNewHospitalDistrict(event.target.value)}
          SelectProps={{ native: true }}
        >
          {districts.map((district) => (
            <option key={district} value={district}>{district}</option>
          ))}
        </TextField>
        <Button variant="contained" onClick={() => void onAddHospital()}>Add Hospital</Button>
      </div>

      <TextField
        size="small"
        fullWidth
        label="Search hospital or district"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      <div className="mt-3 space-y-3">
        {districtGroups.map((group) => (
          <section key={group.district} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-800">{group.district}</p>
              <p className="text-xs text-slate-600">Hospitals: {group.hospitals.length}</p>
            </div>

            {group.hospitals.length === 0 ? (
              <p className="text-xs text-slate-500">No hospital mapped in this district.</p>
            ) : (
              <div className="space-y-2">
                {group.hospitals.map((hospital) => (
                  <article key={hospital.id} className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800">{hospital.hospitalName}</p>
                        <p className="text-xs text-slate-500">Doctors: {hospital.doctorCount}</p>
                      </div>
                      <Switch
                        checked={!disabledHospitals[hospital.hospitalName]}
                        onChange={() => onToggleHospital(hospital.hospitalName)}
                      />
                      <Button variant="outlined" size="small" onClick={() => onStartEditHospital({ id: hospital.id, hospitalName: hospital.hospitalName, district: hospital.district })}>Edit</Button>
                      <Button variant="outlined" size="small" onClick={() => onOpenManage({ id: hospital.id, hospitalName: hospital.hospitalName, district: hospital.district })}>Manage</Button>
                      <Button variant="outlined" color="error" size="small" onClick={() => void onRemoveHospital({ id: hospital.id, hospitalName: hospital.hospitalName, district: hospital.district })}>Remove</Button>
                    </div>

                    {editingHospitalId === hospital.id && (
                      <div className="mt-3 grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-[1fr_1fr_auto_auto]">
                        <TextField size="small" label="Hospital Name" value={editingHospitalName} onChange={(event) => setEditingHospitalName(event.target.value)} />
                        <TextField
                          select
                          size="small"
                          label="District"
                          value={editingHospitalDistrict}
                          onChange={(event) => setEditingHospitalDistrict(event.target.value)}
                          SelectProps={{ native: true }}
                        >
                          {districts.map((district) => (
                            <option key={district} value={district}>{district}</option>
                          ))}
                        </TextField>
                        <Button variant="contained" onClick={() => void onSaveHospitalEdit()}>Save</Button>
                        <Button variant="text" onClick={onCancelEditHospital}>Cancel</Button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      <Drawer anchor="right" open={Boolean(managingHospital)} onClose={() => setManagingHospitalId(null)}>
        <div className="w-[720px] max-w-[96vw] p-4">
          <h3 className="text-lg font-semibold text-slate-800">Manage Hospital</h3>
          <p className="mt-1 text-sm text-slate-600">{managingHospital?.hospitalName ?? ""}</p>
          {managingHospital?.district && <p className="text-xs text-slate-500">District: {managingHospital.district}</p>}

          <div className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-slate-500">Doctors</p>
              <p className="font-semibold text-slate-800">{doctorsInManagedHospital.length}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Appointments</p>
              <p className="font-semibold text-slate-800">{managedAppointments.length}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Today</p>
              <p className="font-semibold text-slate-800">{managedAppointments.filter((item) => item.appointmentDate === businessDate).length}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Configured Slots</p>
              <p className="font-semibold text-slate-800">{configuredHospitalSlots.length}</p>
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-slate-50 p-3">
            <p className="mb-2 text-sm font-semibold text-slate-800">Appointment Schedule Timing</p>
            {appointmentSlotSummary.length === 0 ? (
              <p className="text-xs text-slate-600">No appointments yet for this hospital.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-3">
                {appointmentSlotSummary.map((item) => (
                  <article key={item.slot} className="rounded-lg bg-white p-2 ring-1 ring-slate-200">
                    <p className="text-xs text-slate-500">Slot</p>
                    <p className="font-semibold text-slate-800">{item.slot}</p>
                    <p className="text-xs text-slate-600">Appointments: {item.count}</p>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 rounded-xl bg-slate-50 p-3">
            <p className="mb-2 text-sm font-semibold text-slate-800">Add Doctor</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <TextField size="small" label="Doctor Code" value={newDoctor.doctorCode} onChange={(event) => setNewDoctor((state) => ({ ...state, doctorCode: event.target.value }))} />
              <TextField size="small" label="Name" value={newDoctor.name} onChange={(event) => setNewDoctor((state) => ({ ...state, name: event.target.value }))} />
              <TextField size="small" label="Designation" value={newDoctor.designation} onChange={(event) => setNewDoctor((state) => ({ ...state, designation: event.target.value }))} />
              <TextField size="small" label="Specialization" value={newDoctor.specialization} onChange={(event) => setNewDoctor((state) => ({ ...state, specialization: event.target.value }))} />
              <TextField size="small" label="Place" value={newDoctor.place} onChange={(event) => setNewDoctor((state) => ({ ...state, place: event.target.value }))} />
              <TextField size="small" label="District" value={newDoctor.district} onChange={(event) => setNewDoctor((state) => ({ ...state, district: event.target.value }))} />
            </div>
            <TextField className="!mt-2" size="small" fullWidth label="Availability Slots (comma separated)" value={newDoctor.availabilitySlots} onChange={(event) => setNewDoctor((state) => ({ ...state, availabilitySlots: event.target.value }))} />
            <div className="mt-2 flex justify-end">
              <Button variant="contained" onClick={() => void onAddDoctor()}>Add Doctor</Button>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-sm font-semibold text-slate-800">Doctors (Editable)</p>
            {doctorsInManagedHospital.map((doctor) => {
              const draft = getDoctorDraft(doctor);
              const slotInput = slotInputByDoctorId[doctor.id] ?? (draft.availabilitySlots ?? []).join(", ");
              return (
                <article key={doctor.id} className="rounded-xl bg-slate-50 p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <TextField size="small" label="Doctor Code" value={draft.doctorCode} onChange={(event) => onChangeDoctorField(doctor, "doctorCode", event.target.value)} />
                    <TextField size="small" label="Name" value={draft.name} onChange={(event) => onChangeDoctorField(doctor, "name", event.target.value)} />
                    <TextField size="small" label="Designation" value={draft.designation} onChange={(event) => onChangeDoctorField(doctor, "designation", event.target.value)} />
                    <TextField size="small" label="Specialization" value={draft.specialization} onChange={(event) => onChangeDoctorField(doctor, "specialization", event.target.value)} />
                    <TextField size="small" label="Place" value={draft.place} onChange={(event) => onChangeDoctorField(doctor, "place", event.target.value)} />
                    <TextField size="small" label="District" value={draft.district} onChange={(event) => onChangeDoctorField(doctor, "district", event.target.value)} />
                  </div>
                  <TextField
                    className="!mt-2"
                    size="small"
                    fullWidth
                    label="Availability Slots (comma separated)"
                    value={slotInput}
                    onChange={(event) => setSlotInputByDoctorId((state) => ({
                      ...state,
                      [doctor.id]: event.target.value
                    }))}
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <Button variant="outlined" color="error" onClick={() => void onDeleteDoctor(doctor.id)}>Remove</Button>
                    <Button variant="contained" onClick={() => void onSaveDoctor(doctor)}>Save</Button>
                  </div>
                </article>
              );
            })}
            {doctorsInManagedHospital.length === 0 && (
              <p className="text-xs text-slate-600">No doctors in this hospital yet.</p>
            )}
          </div>
        </div>
      </Drawer>
    </section>
  );
};
