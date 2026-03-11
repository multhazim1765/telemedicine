import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { createDocument, deleteDocumentById, subscribeCollection, updateDocumentById } from "../../services/firestoreService";
import { Appointment, AppUser, Doctor, MedicineStock, Patient, TriageSession } from "../../types/models";
import { prescriptionAgent } from "../../agents/prescriptionAgent";
import { createPharmacyRequest } from "../../agents/pharmacyAgent";
import { nowIso } from "../../utils/date";
import { useAuth } from "../../hooks/useAuth";
import { deleteMyDoctorAccount } from "../../services/authService";
import { Link, useNavigate, useParams } from "react-router-dom";
import { sendPrescriptionSMSNow } from "../../services/functionService";
import { hospitalNameToSlug, hospitalSlugToName } from "../../data/hospitalDoctors";
import { buildClinicalDecisionSummary, buildPrescriptionSmsTemplate, runClinicalDecisionSupport } from "../../services/clinicalDecisionService";
import { useBusinessDate } from "../../hooks/useBusinessDate";
import { BusinessDateBadge } from "../../components/ui/BusinessDateBadge";
import { IndiaMedicineCatalogItem, searchIndiaMedicines, searchIndiaMedicinesFull } from "../../data/indiaMedicineCatalog";

export const DoctorDashboard = () => {
  const navigate = useNavigate();
  const { doctorId: routeDoctorId, hospitalSlug } = useParams();
  const { user } = useAuth();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [pharmacies, setPharmacies] = useState<AppUser[]>([]);
  const [triageSessions, setTriageSessions] = useState<TriageSession[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [medicineStocks, setMedicineStocks] = useState<MedicineStock[]>([]);
  const [notes, setNotes] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [selectedAppointmentId, setSelectedAppointmentId] = useState("");
  const [suppressTokenSession, setSuppressTokenSession] = useState(false);
  const [selectedResetSlot, setSelectedResetSlot] = useState("");
  const [feverDays, setFeverDays] = useState(0);
  const [reviewAfterDays, setReviewAfterDays] = useState(3);
  const [editableDosage, setEditableDosage] = useState<Record<string, string>>({});
  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const [overrideText, setOverrideText] = useState("");
  const [manualMedicineName, setManualMedicineName] = useState("");
  const [manualMedicineDosage, setManualMedicineDosage] = useState("");
  const [manualMedicineSuggestions, setManualMedicineSuggestions] = useState<IndiaMedicineCatalogItem[]>([]);
  const [selectedPharmacyId, setSelectedPharmacyId] = useState("");
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusText, setStatusText] = useState("");
  const businessDate = useBusinessDate();
  const istToday = useMemo(
    () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }),
    []
  );

  useEffect(() => {
    const unsubDoctors = subscribeCollection("doctors", setDoctors);
    const unsubUsers = subscribeCollection("users", (entries) => {
      setPharmacies(entries.filter((entry) => entry.role === "pharmacy"));
    });
    const unsubTriage = subscribeCollection("triage_sessions", setTriageSessions);
    const unsubPatients = subscribeCollection("patients", setPatients);
    const unsubAppointments = subscribeCollection("appointments", setAppointments);
    const unsubStocks = subscribeCollection("medicine_stock", setMedicineStocks);
    return () => {
      unsubDoctors();
      unsubUsers();
      unsubTriage();
      unsubPatients();
      unsubAppointments();
      unsubStocks();
    };
  }, []);

  const activeDoctorId = routeDoctorId ?? user?.uid ?? "unknown-doctor";
  const routeHospitalName = hospitalSlug ? hospitalSlugToName(hospitalSlug) : undefined;
  const scopedHospitalName = user?.hospitalName ?? routeHospitalName;

  const scopedDoctors = scopedHospitalName
    ? doctors.filter((entry) => entry.hospitalName === scopedHospitalName)
    : doctors;

  const matchedDoctor = scopedDoctors.find(
    (entry) => entry.id === activeDoctorId || entry.userId === activeDoctorId
  );

  const activeDoctor = matchedDoctor ?? scopedDoctors[0] ?? null;

  const activeDoctorKey = activeDoctor?.id ?? activeDoctorId;
  const activeHospitalSlug = hospitalNameToSlug(activeDoctor?.hospitalName ?? scopedHospitalName ?? "");

  const effectiveDoctorId = activeDoctor?.id ?? activeDoctorId;

  const selectedAppointment = selectedAppointmentId
    ? appointments.find((item) => item.id === selectedAppointmentId)
    : undefined;

  const selectedSession = suppressTokenSession
    ? triageSessions.find((item) => item.id === selectedSessionId)
    : selectedAppointment
      ? triageSessions.find(
        (item) => item.id === selectedAppointment.triageSessionId || item.patientId === selectedAppointment.patientId
      )
      : triageSessions.find((item) => item.id === selectedSessionId);

  const selectedPatient = selectedSession
    ? patients.find((patient) => patient.userId === selectedSession.patientId || patient.id === selectedSession.patientId)
    : selectedAppointment
      ? patients.find((patient) => patient.userId === selectedAppointment.patientId || patient.id === selectedAppointment.patientId)
      : undefined;

  useEffect(() => {
    if (!pharmacies.some((pharmacy) => pharmacy.uid === selectedPharmacyId)) {
      setSelectedPharmacyId(pharmacies[0]?.uid ?? "");
    }
  }, [pharmacies, selectedPharmacyId]);

  const cdsOutput = useMemo(() => {
    if (!selectedSession) {
      return null;
    }

    return runClinicalDecisionSupport({
      session: selectedSession,
      patient: selectedPatient,
      feverDays,
      stocks: medicineStocks
    });
  }, [selectedSession, selectedPatient, feverDays, medicineStocks]);

  useEffect(() => {
    if (!cdsOutput?.medicines.length) {
      return;
    }

    setEditableDosage((current) => {
      const next = { ...current };
      for (const medicine of cdsOutput.medicines) {
        if (!next[medicine.medicineName]) {
          next[medicine.medicineName] = medicine.suggestedDosage;
        }
      }
      return next;
    });
  }, [cdsOutput]);

  const doctorsByHospital = scopedDoctors.reduce<Record<string, Doctor[]>>((acc, doctor) => {
    const key = doctor.hospitalName || "Unknown Hospital";
    acc[key] = acc[key] ?? [];
    acc[key].push(doctor);
    return acc;
  }, {});

  const buildPrescriptionDraft = () => {
    const parsedOverride = overrideText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [medicine, dosage] = line.split("|").map((item) => item.trim());
        return {
          medicine,
          dosage: dosage || editableDosage[medicine] || "As advised"
        };
      })
      .filter((entry) => entry.medicine);

    const cdsBasedDraft = (cdsOutput?.medicines ?? []).map((item) => {
      const selectedMedicine = item.inStock
        ? item.medicineName
        : item.alternativeMedicineNames[0] || item.medicineName;
      return {
        medicine: selectedMedicine,
        dosage: editableDosage[selectedMedicine] || item.suggestedDosage
      };
    });

    const fallbackDraft = prescriptionAgent(notes);

    return overrideEnabled && parsedOverride.length > 0
      ? parsedOverride
      : cdsBasedDraft.length > 0
        ? cdsBasedDraft
        : fallbackDraft.medicines.map((medicine, index) => ({
          medicine,
          dosage: fallbackDraft.dosageInstructions[index] || "As advised"
        }));
  };

  const prescriptionPreview = useMemo(
    () => buildPrescriptionDraft(),
    [cdsOutput, editableDosage, notes, overrideEnabled, overrideText]
  );

  useEffect(() => {
    let active = true;
    const query = manualMedicineName.trim();

    if (!query) {
      setManualMedicineSuggestions([]);
      return () => {
        active = false;
      };
    }

    // Show local matches instantly while full chunked dataset loads.
    setManualMedicineSuggestions(searchIndiaMedicines({ query, limit: 20 }));

    const timer = window.setTimeout(() => {
      void searchIndiaMedicinesFull({ query, limit: 120 }).then((fullMatches) => {
        if (active) {
          setManualMedicineSuggestions(fullMatches);
        }
      }).catch(() => {
        if (active) {
          setManualMedicineSuggestions([]);
        }
      });
    }, 120);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [manualMedicineName]);

  const appendManualMedicine = () => {
    const medicineName = manualMedicineName.trim();
    if (!medicineName) {
      setStatusText("Type or choose a medicine name to add it manually.");
      return;
    }

    const dosage = manualMedicineDosage.trim() || "As advised";
    const line = `${medicineName} | ${dosage}`;
    setOverrideEnabled(true);
    setOverrideText((current) => (current.trim() ? `${current.trim()}\n${line}` : line));
    setManualMedicineName("");
    setManualMedicineDosage("");
    setStatusText(`Added ${medicineName} to manual prescription list.`);
  };

  const getSubmissionBlocker = (): string | null => {
    if (!notes.trim()) {
      return "Enter consultation notes before generating prescription.";
    }
    if (!selectedAppointmentId && !selectedSessionId) {
      return "Select an appointment token or triage session first.";
    }
    if (selectedAppointmentId && !selectedAppointment) {
      return "Selected appointment token is no longer available.";
    }
    if (!selectedSession && !selectedAppointment) {
      return "Unable to find triage session for this prescription.";
    }
    if (!selectedPharmacyId) {
      return "Select a pharmacy before sending prescription.";
    }
    if (buildPrescriptionDraft().length === 0) {
      return "No medicines selected. Add override entries or include Med:/Dose: lines.";
    }
    return null;
  };

  const submitConsultation = async () => {
    if (isSubmitting) {
      return;
    }

    const blocker = getSubmissionBlocker();
    if (blocker) {
      setStatusText(blocker);
      setConfirmSendOpen(false);
      return;
    }

    let session = selectedSession;
    const appointmentContext = selectedAppointment;

    if (!session && !appointmentContext) {
      setStatusText("Select an appointment token or triage session first.");
      setConfirmSendOpen(false);
      return;
    }

    if (!session && appointmentContext) {
      const fallbackSessionId = await createDocument("triage_sessions", {
        patientId: appointmentContext.patientId,
        patientName: appointmentContext.patientName,
        patientPhone: appointmentContext.patientPhone,
        symptoms: ["appointment token only"],
        result: {
          severityScore: 0,
          severityLevel: "low",
          recommendedAction: "Prescription from appointment token"
        },
        preferredSpecialization: appointmentContext.specialization,
        assignedDoctorId: effectiveDoctorId,
        createdAt: nowIso()
      });

      session = {
        id: fallbackSessionId,
        patientId: appointmentContext.patientId,
        patientName: appointmentContext.patientName,
        patientPhone: appointmentContext.patientPhone,
        symptoms: ["appointment token only"],
        result: {
          severityScore: 0,
          severityLevel: "low",
          recommendedAction: "Prescription from appointment token"
        },
        preferredSpecialization: appointmentContext.specialization,
        assignedDoctorId: effectiveDoctorId,
        createdAt: nowIso()
      };
      setSelectedSessionId(fallbackSessionId);
      setSuppressTokenSession(false);
    }

    if (!session) {
      setStatusText("Unable to resolve appointment or triage session for this prescription.");
      setConfirmSendOpen(false);
      return;
    }

    const latestAppointment = appointments
      .filter((item) => item.patientId === session.patientId && item.doctorId === effectiveDoctorId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

    const resolvedPatientPhone =
      session.patientPhone ??
      latestAppointment?.patientPhone ??
      patients.find((patient) => patient.userId === session.patientId)?.phone ??
      "+910000000000";

    const finalDraft = buildPrescriptionDraft();

    if (finalDraft.length === 0) {
      setStatusText("No medicines selected. Add override entries or include Med:/Dose: lines.");
      setConfirmSendOpen(false);
      return;
    }

    if (!selectedPharmacyId) {
      setStatusText("Select a pharmacy before sending prescription.");
      setConfirmSendOpen(false);
      return;
    }

    setIsSubmitting(true);
    let pharmacyRequestId = "";

    try {
      const clinicalDecision = cdsOutput
        ? buildClinicalDecisionSummary({
          session,
          notes,
          feverDays,
          reviewAfterDays,
          output: cdsOutput,
          prescribedMedicines: finalDraft
        })
        : undefined;

      const consultationId = await createDocument("consultations", {
        triageSessionId: session.id,
        patientId: session.patientId,
        doctorId: effectiveDoctorId,
        notes,
        clinicalDecision,
        createdAt: nowIso()
      });

      const generated = {
        medicines: finalDraft.map((entry) => entry.medicine),
        dosageInstructions: finalDraft.map((entry) => entry.dosage),
        notes,
        clinicalDecision
      };
      const prescriptionId = await createDocument("prescriptions", {
        consultationId,
        patientId: session.patientId,
        doctorId: effectiveDoctorId,
        medicines: generated.medicines,
        dosageInstructions: generated.dosageInstructions,
        notes: generated.notes,
        clinicalDecision: generated.clinicalDecision,
        createdAt: nowIso()
      });

      const prescriptionRecord = {
        id: prescriptionId,
        consultationId,
        patientId: session.patientId,
        doctorId: effectiveDoctorId,
        medicines: generated.medicines,
        dosageInstructions: generated.dosageInstructions,
        notes: generated.notes,
        clinicalDecision: generated.clinicalDecision,
        createdAt: nowIso()
      };

      const smsBody = buildPrescriptionSmsTemplate({
        medicines: finalDraft,
        reviewAfterDays,
        clinicalDecision
      });

      pharmacyRequestId = await createPharmacyRequest(
        prescriptionRecord,
        resolvedPatientPhone,
        activeDoctor?.name,
        smsBody,
        selectedPharmacyId
      );

      setNotes("");
      setConfirmSendOpen(false);
      setStatusText("Generating prescription and sending SMS...");
      const smsResult = await sendPrescriptionSMSNow({
        patientPhone: resolvedPatientPhone,
        medicines: generated.medicines,
        dosageInstructions: generated.dosageInstructions,
        reviewAfterDays,
        customMessage: smsBody,
        clinicalDecision,
        requestId: pharmacyRequestId,
        doctorName: activeDoctor?.name ?? "Doctor"
      });
      await updateDocumentById("pharmacy_requests", pharmacyRequestId, {
        smsDeliveryStatus: "sent",
        smsMessageId: smsResult.messageId,
        smsError: ""
      });
      const statusLabel = smsResult.status === "queued" ? "queued" : smsResult.status;
      setStatusText(`Prescription sent. SMS ${statusLabel} for ${smsResult.to} (Message ID: ${smsResult.messageId || "N/A"}).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      if (pharmacyRequestId) {
        await updateDocumentById("pharmacy_requests", pharmacyRequestId, {
          smsDeliveryStatus: "failed",
          smsError: message
        });
        setStatusText(`Prescription saved, but SMS failed: ${message}`);
      } else {
        setStatusText(`Failed to send prescription: ${message}`);
      }
      setConfirmSendOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onDeleteMyAccount = async () => {
    if (!confirm("Delete your doctor account permanently?")) {
      return;
    }
    try {
      await deleteMyDoctorAccount();
      navigate("/signup");
    } catch (error) {
      setStatusText((error as Error).message);
    }
  };

  const myTodayAppointments = appointments
    .filter(
      (item) =>
        item.doctorId === effectiveDoctorId &&
        (item.appointmentDate === businessDate || item.appointmentDate === istToday) &&
        item.status === "booked"
    )
    .sort((a, b) => {
      if (a.slot === b.slot) {
        return a.tokenNumber - b.tokenNumber;
      }
      return a.slot.localeCompare(b.slot);
    });

  const slotGroups = myTodayAppointments.reduce<Record<string, Appointment[]>>((acc, appointment) => {
    acc[appointment.slot] = acc[appointment.slot] ?? [];
    acc[appointment.slot].push(appointment);
    return acc;
  }, {});

  const resetAllTokensForToday = async () => {
    await Promise.all(myTodayAppointments.map((item) => deleteDocumentById("appointments", item.id)));
    setStatusText(`All tokens reset for ${businessDate}.`);
  };

  const resetSelectedSlotTokens = async () => {
    if (!selectedResetSlot) {
      return;
    }
    const forSlot = myTodayAppointments.filter((item) => item.slot === selectedResetSlot);
    await Promise.all(forSlot.map((item) => deleteDocumentById("appointments", item.id)));
    setStatusText(`Tokens reset for ${selectedResetSlot} on ${businessDate}.`);
  };

  const filteredTriageSessions = triageSessions.filter(
    (session) => !session.assignedDoctorId || session.assignedDoctorId === effectiveDoctorId
  );

  return (
    <DashboardLayout title="Doctor Dashboard">
      <BusinessDateBadge />
      <section className="card mb-4">
        <h2 className="mb-2 text-base font-semibold">Doctor Pages</h2>
        <p className="mb-2 text-sm text-slate-700">
          Active Doctor: <span className="font-semibold">{activeDoctor?.name ?? activeDoctorId}</span>
        </p>
        <div className="space-y-3">
          {Object.entries(doctorsByHospital).map(([hospitalName, hospitalDoctors]) => (
            <div key={hospitalName} className="rounded-md bg-slate-50 p-3 ring-1 ring-slate-200">
              <p className="mb-2 text-xs font-semibold text-slate-700">{hospitalName}</p>
              <div className="flex flex-wrap gap-2">
                {hospitalDoctors.map((doctor) => (
                  <Link
                    key={doctor.id}
                    to={activeHospitalSlug ? `/doctor/hospital/${activeHospitalSlug}/${doctor.id}` : `/doctor/${doctor.id}`}
                    className={`btn ${doctor.id === activeDoctorKey ? "bg-teal-700 text-white" : "bg-slate-200 text-slate-900"}`}
                  >
                    {doctor.name}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card mb-4">
        <h2 className="mb-2 text-base font-semibold">Appointment Tokens By Slot ({businessDate})</h2>
        {Object.keys(slotGroups).length === 0 ? (
          <p className="text-sm text-slate-600">No appointments booked yet.</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(slotGroups).map(([slot, items]) => (
              <div key={slot} className="rounded-md bg-slate-100 p-3 text-sm">
                <p className="font-semibold">Slot {slot}</p>
                <ul className="mt-1 space-y-1">
                  {items.map((item) => {
                    const patient = patients.find((entry) => entry.userId === item.patientId);
                    return (
                      <li key={item.id}>
                        Token #{item.tokenNumber} · {item.patientName ?? patient?.name ?? item.patientId} · {item.patientPhone ?? patient?.phone ?? "N/A"}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <select
            className="input"
            value={selectedResetSlot}
            onChange={(event) => setSelectedResetSlot(event.target.value)}
          >
            <option value="">Select slot to reset</option>
            {Object.keys(slotGroups).map((slot) => (
              <option key={slot} value={slot}>{slot}</option>
            ))}
          </select>
          <button className="btn-muted" onClick={() => void resetSelectedSlotTokens()}>
            Reset Slot Tokens
          </button>
          <button className="btn-muted" onClick={() => void resetAllTokensForToday()}>
            Reset All On Date
          </button>
        </div>
      </section>

      <section className="card mb-4">
        <h2 className="mb-2 text-base font-semibold">Select Token For Prescription</h2>
        <select
          className="input"
          value={selectedAppointmentId}
          onChange={(event) => {
            const appointmentId = event.target.value;
            setSelectedAppointmentId(appointmentId);
            setSuppressTokenSession(false);
            const selected = appointments.find((item) => item.id === appointmentId);
            if (selected?.triageSessionId) {
              setSelectedSessionId(selected.triageSessionId);
            } else if (!appointmentId) {
              setSelectedSessionId("");
            }
          }}
        >
          <option value="">Choose appointment token</option>
          {myTodayAppointments.map((appointment) => (
            <option key={appointment.id} value={appointment.id}>
              Token #{appointment.tokenNumber} · {appointment.slot} · {appointment.patientName ?? appointment.patientId}
            </option>
          ))}
        </select>
      </section>

      <section className="card mb-4">
        <h2 className="mb-2 text-base font-semibold">Triage Sessions</h2>
        <div className="space-y-2 text-sm">
          {filteredTriageSessions.map((session) => (
            <label key={session.id} className="flex cursor-pointer items-start gap-2 rounded-md bg-slate-100 p-2">
              <input
                type="checkbox"
                checked={selectedSessionId === session.id}
                onChange={() => {
                  const isDeselecting = selectedSessionId === session.id;
                  setSelectedSessionId(isDeselecting ? "" : session.id);
                  setSuppressTokenSession(isDeselecting);
                  // Clear token only when selecting a triage session manually.
                  if (!isDeselecting) {
                    setSelectedAppointmentId("");
                  }
                }}
              />
              <span>
                {session.symptoms.join(", ")} · {session.result.severityLevel}
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="mb-2 text-base font-semibold">Consultation & Clinical Decision Support</h2>
        <div className="mb-4 rounded-md bg-slate-50 p-3 ring-1 ring-slate-200">
          {!selectedSession && (
            <p className="text-sm text-slate-600">Select an appointment token or triage session to review CDS details. You can still type notes and select a pharmacy below.</p>
          )}
          {selectedSession && (
            <>
              <h3 className="text-sm font-semibold text-slate-900">Clinical Decision Support</h3>
              <p className="mt-1 text-xs text-slate-700">
                Patient: <span className="font-semibold">{selectedPatient?.name ?? selectedSession.patientName ?? selectedSession.patientId}</span>
              </p>
              <p className="text-xs text-slate-700">
                Symptoms: <span className="font-semibold">{selectedSession.symptoms.join(", ")}</span>
              </p>
              <p className="text-xs text-slate-700">
                Triage severity: <span className="font-semibold">{selectedSession.result.severityLevel.toUpperCase()} ({selectedSession.result.severityScore})</span>
              </p>
              <p className="text-xs text-slate-700">
                Recommended action: <span className="font-semibold">{selectedSession.result.recommendedAction}</span>
              </p>
              {cdsOutput && (
                <>
                  <p className="mt-1 text-xs text-slate-700">
                    Condition: <span className="font-semibold">{cdsOutput.match?.condition ?? "No >=70% rule match"}</span>
                  </p>
                  <p className="text-xs text-slate-700">
                    Risk Score: <span className="font-semibold">{cdsOutput.risk.riskScore}% ({cdsOutput.risk.riskLevel.toUpperCase()})</span>
                  </p>
                  {cdsOutput.match && (
                    <p className="text-xs text-slate-700">
                      Suggested because symptoms matched: {cdsOutput.match.matchedSymptoms.join(" + ")}
                    </p>
                  )}
                  {cdsOutput.risk.reasons.length > 0 && (
                    <ul className="mt-2 list-disc pl-5 text-xs text-slate-700">
                      {cdsOutput.risk.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  )}
                  {cdsOutput.allMatches.length > 1 && (
                    <div className="mt-2 text-xs text-slate-700">
                      <p className="font-semibold text-slate-800">Additional rule matches</p>
                      <ul className="mt-1 list-disc pl-5">
                        {cdsOutput.allMatches.slice(1, 4).map((match) => (
                          <li key={match.ruleId}>{match.condition} ({match.matchPercent}% {match.triageOption})</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="text-xs text-slate-700">
                  Fever days
                  <input
                    className="input mt-1"
                    type="number"
                    min={0}
                    value={feverDays}
                    onChange={(event) => setFeverDays(Number(event.target.value))}
                  />
                </label>
                <label className="text-xs text-slate-700">
                  Review after (days)
                  <input
                    className="input mt-1"
                    type="number"
                    min={1}
                    value={reviewAfterDays}
                    onChange={(event) => setReviewAfterDays(Number(event.target.value))}
                  />
                </label>
              </div>

              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold text-slate-800">Suggested Medicines (stock-aware)</p>
                {!cdsOutput || cdsOutput.medicines.length === 0 ? (
                  <p className="text-xs text-slate-600">No non-allergic medicines matched current rules.</p>
                ) : (
                  cdsOutput.medicines.map((item) => (
                    <div key={item.medicineId} className="rounded-md bg-white p-2 ring-1 ring-slate-200">
                      <p className="text-sm font-medium text-slate-900">{item.medicineName}</p>
                      <p className="text-xs text-slate-600">{item.explanation}</p>
                      <p className={`text-xs ${item.inStock ? "text-emerald-700" : "text-amber-700"}`}>
                        {item.inStock ? "In stock" : `Out of stock. Alternative: ${item.alternativeMedicineNames.join(", ") || "No alternative"}`}
                      </p>
                      <input
                        className="input mt-1"
                        value={editableDosage[item.medicineName] || item.suggestedDosage}
                        onChange={(event) =>
                          setEditableDosage((current) => ({
                            ...current,
                            [item.medicineName]: event.target.value
                          }))
                        }
                      />
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          <label className="mt-3 flex items-center gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={overrideEnabled}
              onChange={(event) => setOverrideEnabled(event.target.checked)}
            />
            Override suggested medicines
          </label>
          {overrideEnabled && (
            <textarea
              className="input mt-2 min-h-24"
              placeholder="One medicine per line: Medicine Name | Dosage"
              value={overrideText}
              onChange={(event) => setOverrideText(event.target.value)}
            />
          )}

          <div className="mt-3 rounded-md bg-white p-3 ring-1 ring-slate-200">
            <p className="text-xs font-semibold text-slate-800">Manual medicine type (full dataset suggestions)</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1.3fr_1fr_auto]">
              <input
                className="input"
                list="doctor-medicine-suggestions"
                placeholder="Type at least 1 character"
                value={manualMedicineName}
                onChange={(event) => setManualMedicineName(event.target.value)}
              />
              <input
                className="input"
                placeholder="Dosage (e.g. 1 tablet twice daily)"
                value={manualMedicineDosage}
                onChange={(event) => setManualMedicineDosage(event.target.value)}
              />
              <button type="button" className="btn-muted" onClick={appendManualMedicine}>
                Add Medicine
              </button>
            </div>
            <datalist id="doctor-medicine-suggestions">
              {manualMedicineSuggestions.map((item) => (
                <option key={item.id} value={item.medicineName}>
                  {(item.uses[0] ?? item.therapeuticClass) || "General"}
                </option>
              ))}
            </datalist>
            {manualMedicineSuggestions.length > 0 && (
              <p className="mt-2 text-xs text-slate-600">
                Suggested from dataset: {manualMedicineSuggestions.slice(0, 3).map((item) => item.medicineName).join(", ")}
              </p>
            )}
            <p className="mt-1 text-xs text-slate-500">Medicine suggestions are loaded from the full A-Z dataset with chunked loading.</p>
          </div>

          <div className="mt-3 rounded-md bg-white p-3 ring-1 ring-slate-200">
            <p className="text-xs font-semibold text-slate-800">Consultation notes</p>
            <textarea
              className="input mt-2 min-h-32"
              placeholder="Assessment, counselling, follow-up instructions, contraindications, and any custom prescription notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          <label className="mt-3 block text-xs text-slate-700">
            Send to pharmacy
            <select
              className="input mt-1"
              value={selectedPharmacyId}
              onChange={(event) => setSelectedPharmacyId(event.target.value)}
            >
              <option value="">Select pharmacy</option>
              {pharmacies.map((pharmacy) => (
                <option key={pharmacy.uid} value={pharmacy.uid}>
                  {pharmacy.pharmacyName ?? pharmacy.displayName}
                  {pharmacy.district ? ` - ${pharmacy.district}` : ""}
                </option>
              ))}
            </select>
          </label>

          {prescriptionPreview.length > 0 && (
            <div className="mt-3 rounded-md bg-white p-3 ring-1 ring-slate-200">
              <p className="text-xs font-semibold text-slate-800">Prescription preview</p>
              <ul className="mt-2 space-y-1 text-xs text-slate-700">
                {prescriptionPreview.map((item) => (
                  <li key={`${item.medicine}-${item.dosage}`}>{item.medicine} - {item.dosage}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const blocker = getSubmissionBlocker();
            if (blocker) {
              setStatusText(blocker);
              return;
            }
            setConfirmSendOpen(true);
          }}
        >
          <button className="btn-primary">Approve & Send SMS</button>
        </form>
        {statusText && <p className="mt-2 text-xs text-teal-700">{statusText}</p>}

        <AnimatePresence>
          {confirmSendOpen && (
            <>
              <motion.div
                className="fixed inset-0 z-40 bg-slate-900/40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setConfirmSendOpen(false)}
              />
              <motion.div
                className="fixed left-1/2 top-1/2 z-50 w-[90%] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-4 shadow-lg ring-1 ring-slate-200"
                initial={{ opacity: 0, scale: 0.96, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 6 }}
                transition={{ duration: 0.22 }}
              >
                <h3 className="text-base font-semibold text-slate-800">Confirm Prescription</h3>
                <p className="mt-2 text-sm text-slate-600">This will create prescription and call the existing SMS API endpoint.</p>
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" className="btn-muted" onClick={() => setConfirmSendOpen(false)}>Cancel</button>
                  <button type="button" className="btn-primary" disabled={isSubmitting} onClick={() => void submitConsultation()}>
                    {isSubmitting ? "Sending..." : "Confirm & Send"}
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <div className="mt-4 border-t border-slate-200 pt-3">
          <button className="btn-muted" onClick={() => void onDeleteMyAccount()}>
            Delete My Doctor Account
          </button>
        </div>
      </section>
    </DashboardLayout>
  );
};
