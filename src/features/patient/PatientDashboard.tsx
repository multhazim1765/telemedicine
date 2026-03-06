import { FormEvent, useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { triageAgent } from "../../agents/triageAgent";
import { appointmentAgent } from "../../agents/appointmentAgent";
import { createDocument, subscribeCollection, updateDocumentById } from "../../services/firestoreService";
import { Appointment, Doctor, Patient, PharmacyRequest, TriageResult } from "../../types/models";
import { nowIso } from "../../utils/date";
import { useAuth } from "../../hooks/useAuth";
import { sendPrescriptionSMSNow } from "../../services/functionService";
import { DashboardCard } from "../../components/ui/DashboardCard";
import { CalendarClock, ClipboardList, ShieldAlert, Syringe } from "lucide-react";
import { useBusinessDate } from "../../hooks/useBusinessDate";
import { BusinessDateBadge } from "../../components/ui/BusinessDateBadge";
import { districts } from "../../constants/districts";

const symptomOptions = [
  "chest_pain",
  "breathlessness",
  "high_fever",
  "prolonged_fever",
  "vomiting",
  "severe_headache",
  "bleeding",
  "weakness",
  "cough",
  "sore_throat"
];

export const PatientDashboard = () => {
  const { user } = useAuth();
  const businessDate = useBusinessDate();
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [result, setResult] = useState<TriageResult | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [specialization, setSpecialization] = useState("general");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [patientDistrict, setPatientDistrict] = useState("");
  const [suggestedDoctor, setSuggestedDoctor] = useState<Doctor | null>(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [lastTriageSessionId, setLastTriageSessionId] = useState("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [bookingMessage, setBookingMessage] = useState("");
  const [myRequests, setMyRequests] = useState<PharmacyRequest[]>([]);
  const [resendState, setResendState] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const unsubDoctors = subscribeCollection("doctors", setDoctors);
    const unsubPatients = subscribeCollection("patients", (patientList) => {
      const myRecord = (patientList as Patient[]).find((item) => item.userId === user?.uid || item.id === user?.uid);
      const resolvedDistrict = myRecord?.district ?? myRecord?.village ?? "";
      setPatientDistrict(resolvedDistrict);
      setSelectedDistrict(resolvedDistrict);
    });
    const unsubAppointments = subscribeCollection("appointments", setAppointments);
    const unsubPharmacy = subscribeCollection("pharmacy_requests", (requests) => {
      setMyRequests(requests.filter((request) => request.patientId === user?.uid));
    });

    return () => {
      unsubDoctors();
      unsubPatients();
      unsubAppointments();
      unsubPharmacy();
    };
  }, [user?.uid]);

  const canSubmit = useMemo(() => symptoms.length > 0, [symptoms]);
  const effectiveDistrict = patientDistrict || selectedDistrict;
  const filteredDoctors = useMemo(
    () => {
      if (!effectiveDistrict) {
        return [];
      }
      return doctors.filter((doctor) => doctor.place === effectiveDistrict || doctor.district === effectiveDistrict);
    },
    [doctors, effectiveDistrict]
  );

  const selectedDoctor = useMemo(
    () => filteredDoctors.find((doctor) => doctor.id === selectedDoctorId) ?? null,
    [filteredDoctors, selectedDoctorId]
  );

  const myAppointments = useMemo(
    () => appointments.filter((appointment) => appointment.patientId === user?.uid),
    [appointments, user?.uid]
  );

  const latestAppointment = myAppointments[0];

  useEffect(() => {
    if (!selectedDoctorId) {
      return;
    }
    const doctorInFiltered = filteredDoctors.find((doctor) => doctor.id === selectedDoctorId);
    if (!doctorInFiltered) {
      setSelectedDoctorId("");
      setSelectedSlot("");
    }
  }, [filteredDoctors, selectedDoctorId]);

  const toggleSymptom = (symptom: string) => {
    setSymptoms((prev) =>
      prev.includes(symptom) ? prev.filter((item) => item !== symptom) : [...prev, symptom]
    );
  };

  const submitTriage = async (event: FormEvent) => {
    event.preventDefault();
    const triage = await triageAgent(symptoms);
    setResult(triage);

    const doctor = appointmentAgent({ specialization, doctors: filteredDoctors });
    setSuggestedDoctor(doctor);
    setSelectedDoctorId(doctor?.id ?? "");
    setSelectedSlot(doctor?.availabilitySlots[0] ?? "");
    setBookingMessage("");

    const triageSessionId = await createDocument("triage_sessions", {
      patientId: user?.uid ?? "unknown-patient",
      patientName: user?.displayName ?? "Unknown Patient",
      patientPhone: user?.phone ?? "",
      symptoms,
      result: triage,
      preferredSpecialization: specialization,
      assignedDoctorId: doctor?.id,
      createdAt: nowIso()
    });

    setLastTriageSessionId(triageSessionId);
  };

  return (
    <DashboardLayout title="Patient Dashboard">
      <BusinessDateBadge />
      <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard title="Appointments" value={myAppointments.length} icon={<CalendarClock className="h-4 w-4" />} />
        <DashboardCard title="Prescriptions" value={myRequests.length} icon={<ClipboardList className="h-4 w-4" />} />
        <DashboardCard title="High Risk Results" value={result?.severityLevel === "high" ? 1 : 0} icon={<ShieldAlert className="h-4 w-4" />} />
        <DashboardCard title="SMS Updates" value={myRequests.filter((item) => item.smsDeliveryStatus === "sent").length} icon={<Syringe className="h-4 w-4" />} />
      </section>

      <section className="card mb-4">
        <h2 className="mb-2 text-base font-semibold">Appointment Tracking</h2>
        {latestAppointment ? (
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <p>Next Date: <span className="font-semibold">{latestAppointment.appointmentDate}</span></p>
            <p>Slot: <span className="font-semibold">{latestAppointment.slot}</span></p>
            <p>Token: <span className="font-semibold">#{latestAppointment.tokenNumber}</span></p>
            <p>Status: <span className="font-semibold uppercase">{latestAppointment.status}</span></p>
          </div>
        ) : (
          <p className="text-sm text-slate-600">No booked appointments yet.</p>
        )}
      </section>

      <section className="card mb-4">
        <h2 className="mb-2 text-base font-semibold">Symptom Form</h2>
        {patientDistrict && (
          <p className="mb-2 text-xs text-slate-600">
            Registered district: <span className="font-semibold text-slate-800">{patientDistrict}</span>
          </p>
        )}
        <form onSubmit={submitTriage} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700" htmlFor="district-select">
              Select District
            </label>
            <select
              id="district-select"
              className="input"
              value={effectiveDistrict}
              onChange={(event) => setSelectedDistrict(event.target.value)}
              disabled
            >
              {districts.map((district) => (
                <option key={district} value={district}>
                  {district}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {symptomOptions.map((symptom) => (
              <label key={symptom} className="flex items-center gap-2 rounded-md bg-slate-100 p-2 text-xs">
                <input
                  type="checkbox"
                  checked={symptoms.includes(symptom)}
                  onChange={() => toggleSymptom(symptom)}
                />
                {symptom.replace("_", " ")}
              </label>
            ))}
          </div>

          <select
            className="input"
            value={specialization}
            onChange={(event) => setSpecialization(event.target.value)}
          >
            <option value="general">General Medicine</option>
            <option value="pediatrics">Pediatrics</option>
            <option value="cardiology">Cardiology</option>
          </select>

          <button className="btn-primary" disabled={!canSubmit}>
            Run Triage
          </button>
        </form>
      </section>

      {result && (
        <section className="card mb-4">
          <h2 className="mb-2 text-base font-semibold">Severity Result</h2>
          <p className="text-sm">Score: {result.severityScore}</p>
          <p className="text-sm">Level: {result.severityLevel.toUpperCase()}</p>
          <p className="text-sm">Action: {result.recommendedAction}</p>
        </section>
      )}

      <section className="card">
        <h2 className="mb-2 text-base font-semibold">Appointment View</h2>
        {suggestedDoctor ? (
          <div className="space-y-1 text-sm">
            <p>
              Suggested Doctor: <span className="font-medium">{suggestedDoctor.name}</span> ({suggestedDoctor.specialization})
            </p>
            <p>Region: {suggestedDoctor.city ?? "N/A"}</p>
            <p>Available Slots: {suggestedDoctor.availabilitySlots.join(", ")}</p>
          </div>
        ) : (
          <p className="text-sm text-slate-600">No recommendation yet.</p>
        )}

        {selectedDoctor && (
          <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
            <p className="text-xs text-slate-700">
              Booking for: <span className="font-semibold">{selectedDoctor.name}</span> ({selectedDoctor.hospitalName})
            </p>
            <p className="text-xs font-semibold text-slate-700">Book appointment slot</p>
            <select
              className="input"
              value={selectedSlot}
              onChange={(event) => setSelectedSlot(event.target.value)}
            >
              {selectedDoctor.availabilitySlots.map((slot) => (
                <option key={slot} value={slot}>{slot}</option>
              ))}
            </select>
            <button
              className="btn-primary"
              onClick={async () => {
                if (!user?.uid || !selectedSlot || !selectedDoctor) {
                  return;
                }
                const appointmentDate = businessDate;
                const existingForSlot = appointments.filter(
                  (item) =>
                    item.doctorId === selectedDoctor.id &&
                    item.appointmentDate === appointmentDate &&
                    item.slot === selectedSlot
                );
                const nextToken = existingForSlot.length + 1;

                await createDocument("appointments", {
                  patientId: user.uid,
                  patientName: user?.displayName ?? "Unknown Patient",
                  patientPhone: user?.phone ?? "",
                  triageSessionId: lastTriageSessionId,
                  doctorId: selectedDoctor.id,
                  doctorName: selectedDoctor.name,
                  specialization,
                  slot: selectedSlot,
                  appointmentDate,
                  tokenNumber: nextToken,
                  status: "booked",
                  createdAt: nowIso()
                });

                setBookingMessage(`Appointment booked. Token #${nextToken} at ${selectedSlot}`);
              }}
            >
              Book Appointment
            </button>
            {bookingMessage && <p className="text-xs text-teal-700">{bookingMessage}</p>}
          </div>
        )}

        <div className="mt-3 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
          <p className="mb-2 text-xs font-semibold text-slate-700">All available doctors</p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs text-slate-700">
              <thead>
                <tr className="text-slate-900">
                  <th className="px-2 py-1">Hospital</th>
                  <th className="px-2 py-1">Doctor Name</th>
                  <th className="px-2 py-1">ID</th>
                  <th className="px-2 py-1">Place</th>
                  <th className="px-2 py-1">Designation</th>
                </tr>
              </thead>
              <tbody>
                {filteredDoctors.map((doctor) => (
                  <tr
                    key={doctor.id}
                    className={`cursor-pointer border-t border-slate-200 ${selectedDoctorId === doctor.id ? "bg-teal-50" : ""}`}
                    onClick={() => {
                      setSelectedDoctorId(doctor.id);
                      setSelectedSlot(doctor.availabilitySlots[0] ?? "");
                    }}
                  >
                    <td className="px-2 py-1">{doctor.hospitalName}</td>
                    <td className="px-2 py-1">{doctor.name}</td>
                    <td className="px-2 py-1">{doctor.doctorCode}</td>
                    <td className="px-2 py-1">{doctor.place}</td>
                    <td className="px-2 py-1">{doctor.designation}</td>
                  </tr>
                ))}
                {filteredDoctors.length === 0 && (
                  <tr className="border-t border-slate-200">
                    <td className="px-2 py-2 text-slate-500" colSpan={5}>
                      No doctors available for the selected district.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="card mt-4">
        <h2 className="mb-2 text-base font-semibold">Prescription & Pharmacy Status</h2>
        {myRequests.length === 0 ? (
          <p className="text-sm text-slate-600">No pharmacy requests yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {myRequests.map((request) => (
              <li key={request.id} className="rounded-md bg-slate-100 p-2">
                <p>Medicines: {request.medicines.join(", ")}</p>
                <p>Pharmacy Status: {request.smsStatus}</p>
                <p>SMS Delivery: {request.smsDeliveryStatus ?? "pending"}</p>
                {request.smsDeliveryStatus !== "sent" && (
                  <button
                    className="btn-muted mt-2"
                    disabled={Boolean(resendState[request.id])}
                    onClick={async () => {
                      setResendState((prev) => ({ ...prev, [request.id]: true }));
                      try {
                        const smsResult = await sendPrescriptionSMSNow({
                          patientPhone: request.patientPhone,
                          medicines: request.medicines,
                          requestId: request.id,
                          doctorName: request.doctorName ?? "Doctor"
                        });
                        await updateDocumentById("pharmacy_requests", request.id, {
                          smsDeliveryStatus: "sent",
                          smsMessageId: smsResult.messageId,
                          smsError: ""
                        });
                      } catch (error) {
                        await updateDocumentById("pharmacy_requests", request.id, {
                          smsDeliveryStatus: "failed",
                          smsError: (error as Error).message
                        });
                      } finally {
                        setResendState((prev) => ({ ...prev, [request.id]: false }));
                      }
                    }}
                  >
                    {resendState[request.id] ? "Resending..." : "Resend SMS"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card mt-4">
        <h2 className="mb-2 text-base font-semibold">My Prescriptions</h2>
        <ul className="space-y-2 text-sm">
          {myRequests.map((request) => (
            <li key={`pres-${request.id}`} className="rounded-md bg-slate-100 p-2">
              <p>Doctor: {request.doctorName ?? request.doctorId ?? "N/A"}</p>
              <p>Medicines: {request.medicines.join(", ")}</p>
              <p>SMS Delivery: {request.smsDeliveryStatus ?? "pending"}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="card mt-4">
        <h2 className="mb-2 text-base font-semibold">My Appointments</h2>
        <ul className="space-y-2 text-sm">
          {myAppointments.map((appointment) => {
              const doctor = doctors.find((item) => item.id === appointment.doctorId);
              return (
                <li key={appointment.id} className="rounded-md bg-slate-100 p-2">
                  <p>Doctor: {doctor?.name ?? appointment.doctorId}</p>
                  <p>Date: {appointment.appointmentDate}</p>
                  <p>Slot: {appointment.slot}</p>
                  <p>Token: {appointment.tokenNumber}</p>
                </li>
              );
            })}
        </ul>
      </section>
    </DashboardLayout>
  );
};
