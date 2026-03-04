import { useMemo, useState } from "react";
import { Button, Drawer, Switch, TextField } from "@mui/material";
import { deleteDocumentById, setDocumentById, subscribeCollection } from "../../services/firestoreService";
import { Appointment, Doctor } from "../../types/models";
import { useEffect } from "react";
import { loadAdminPreferences, saveAdminPreferences } from "./adminPreferences";
import { useToast } from "../../components/ui/ToastProvider";
import { useBusinessDate } from "../../hooks/useBusinessDate";
import { BusinessDateBadge } from "../../components/ui/BusinessDateBadge";

export const HospitalManagementPage = () => {
  const { pushToast } = useToast();
  const businessDate = useBusinessDate();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [search, setSearch] = useState("");
  const [disabledHospitals, setDisabledHospitals] = useState<Record<string, boolean>>(() => loadAdminPreferences().disabledHospitals);
  const [managingHospital, setManagingHospital] = useState<string | null>(null);
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
    return () => {
      unsubDoctors();
      unsubAppointments();
    };
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

  const doctorsInManagedHospital = useMemo(
    () => doctors.filter((doctor) => doctor.hospitalName === managingHospital),
    [doctors, managingHospital]
  );

  const managedDoctorIds = useMemo(
    () => new Set(doctorsInManagedHospital.map((doctor) => doctor.id)),
    [doctorsInManagedHospital]
  );

  const managedAppointments = useMemo(() => {
    return appointments.filter((appointment) => managedDoctorIds.has(appointment.doctorId));
  }, [appointments, managedDoctorIds]);

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
    return Array.from(
      new Set(doctorsInManagedHospital.flatMap((doctor) => doctor.availabilitySlots ?? []))
    ).sort((a, b) => a.localeCompare(b));
  }, [doctorsInManagedHospital]);

  const onOpenManage = (hospitalName: string) => {
    setManagingHospital(hospitalName);
    setDraftByDoctorId({});
    setSlotInputByDoctorId({});
  };

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

  const getDoctorDraft = (doctor: Doctor): Doctor => {
    return draftByDoctorId[doctor.id] ?? doctor;
  };

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
    try {
      const draft = getDoctorDraft(doctor);
      const slotText = slotInputByDoctorId[doctor.id] ?? (draft.availabilitySlots ?? []).join(", ");
      const sanitizedSlots = parseSlots(slotText);
      const payload: Doctor = {
        ...doctor,
        ...draft,
        hospitalName: managingHospital ?? draft.hospitalName,
        district: draft.district || draft.place,
        city: draft.city || draft.place,
        availabilitySlots: sanitizedSlots.length > 0 ? sanitizedSlots : ["Morning"]
      };

      await setDocumentById("doctors", doctor.id, payload);
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
      await deleteDocumentById("doctors", doctorId);
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
      const doctorId = generatedCode.toLowerCase().replace(/[^a-z0-9]/g, "");
      const slotList = parseSlots(newDoctor.availabilitySlots);

      await setDocumentById("doctors", doctorId, {
        id: doctorId,
        userId: doctorId,
        doctorCode: generatedCode,
        name: newDoctor.name.trim(),
        hospitalName: managingHospital,
        place: newDoctor.place.trim() || "Unknown",
        district: newDoctor.district.trim() || newDoctor.place.trim() || "Unknown",
        designation: newDoctor.designation.trim() || "Physician",
        specialization: newDoctor.specialization || "general",
        availabilitySlots: slotList.length > 0 ? slotList : ["Morning"],
        city: newDoctor.place.trim() || "Unknown",
        phone: ""
      });

      setNewDoctor({
        doctorCode: "",
        name: "",
        designation: "Physician",
        specialization: "general",
        place: "",
        district: "",
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
              onChange={() => onToggleHospital(hospitalName)}
            />
            <Button variant="outlined" size="small" onClick={() => onOpenManage(hospitalName)}>Manage</Button>
          </article>
        ))}
      </div>

      <Drawer anchor="right" open={Boolean(managingHospital)} onClose={() => setManagingHospital(null)}>
        <div className="w-[720px] max-w-[96vw] p-4">
          <h3 className="text-lg font-semibold text-slate-800">Manage Hospital</h3>
          <p className="mt-1 text-sm text-slate-600">{managingHospital ?? ""}</p>

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
