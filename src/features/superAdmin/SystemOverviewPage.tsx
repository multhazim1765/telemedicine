import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarClock, MessageSquareText, ShieldAlert, Stethoscope, UserRound } from "lucide-react";
import { SkeletonCards } from "../../components/ui/Feedback";
import { listCollection } from "../../services/firestoreService";
import { Appointment, Doctor, Patient, PharmacyRequest, TriageSession } from "../../types/models";
import { DashboardCard } from "../../components/ui/DashboardCard";

const monthLabel = (dateText?: string): string => {
  if (!dateText) {
    return "N/A";
  }
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }
  return date.toLocaleString("en-US", { month: "short" });
};

export const SystemOverviewPage = () => {
  const [loading, setLoading] = useState(true);
  const [loadMessage, setLoadMessage] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [triageSessions, setTriageSessions] = useState<TriageSession[]>([]);
  const [pharmacyRequests, setPharmacyRequests] = useState<PharmacyRequest[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [patientsRes, doctorsRes, appointmentsRes, triageRes, requestsRes] = await Promise.allSettled([
          listCollection("patients"),
          listCollection("doctors"),
          listCollection("appointments"),
          listCollection("triage_sessions"),
          listCollection("pharmacy_requests")
        ]);

        if (cancelled) {
          return;
        }

        setPatients(patientsRes.status === "fulfilled" ? patientsRes.value : []);
        setDoctors(doctorsRes.status === "fulfilled" ? doctorsRes.value : []);
        setAppointments(appointmentsRes.status === "fulfilled" ? appointmentsRes.value : []);
        setTriageSessions(triageRes.status === "fulfilled" ? triageRes.value : []);
        setPharmacyRequests(requestsRes.status === "fulfilled" ? requestsRes.value : []);

        const hasRejected = [patientsRes, doctorsRes, appointmentsRes, triageRes, requestsRes].some(
          (result) => result.status === "rejected"
        );
        if (hasRejected) {
          setLoadMessage("Some analytics data could not be loaded. Showing available data.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const appointmentsToday = appointments.filter((item) => item.appointmentDate === today).length;
  const highRiskCases = triageSessions.filter((item) => item.result.severityLevel === "high").length;
  const smsSentToday = pharmacyRequests.filter((item) => item.smsDeliveryStatus === "sent").length;

  const patientTrendData = useMemo(() => {
    const counts = patients.reduce<Record<string, number>>((acc, patient) => {
      const month = monthLabel(patient.createdAt);
      acc[month] = (acc[month] ?? 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts).map(([month, total]) => ({ month, total }));
  }, [patients]);

  const riskDistributionData = useMemo(() => {
    const buckets = triageSessions.reduce<Record<string, number>>((acc, session) => {
      const key = session.result.severityLevel;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    return [
      { name: "High", value: buckets.high ?? 0, color: "#ef4444" },
      { name: "Medium", value: buckets.medium ?? 0, color: "#f59e0b" },
      { name: "Low", value: buckets.low ?? 0, color: "#2BB673" }
    ];
  }, [triageSessions]);

  const medicineUsageData = useMemo(() => {
    const usage = pharmacyRequests.reduce<Record<string, number>>((acc, request) => {
      request.medicines.forEach((medicine) => {
        acc[medicine] = (acc[medicine] ?? 0) + 1;
      });
      return acc;
    }, {});

    return Object.entries(usage)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [pharmacyRequests]);

  if (loading) {
    return <SkeletonCards count={4} />;
  }

  return (
    <section className="space-y-4">
      {loadMessage && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700 ring-1 ring-amber-200">{loadMessage}</p>
      )}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <DashboardCard title="Total Patients" value={patients.length} icon={<UserRound className="h-4 w-4" />} />
        <DashboardCard title="Active Doctors" value={doctors.length} icon={<Stethoscope className="h-4 w-4" />} />
        <DashboardCard title="Appointments Today" value={appointmentsToday} icon={<CalendarClock className="h-4 w-4" />} />
        <DashboardCard title="High Risk Cases" value={highRiskCases} icon={<ShieldAlert className="h-4 w-4" />} />
        <DashboardCard title="SMS Sent Today" value={smsSentToday} icon={<MessageSquareText className="h-4 w-4" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Patient Trends</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={patientTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="total" stroke="#2BB673" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Risk Distribution</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={riskDistributionData} dataKey="value" outerRadius={90} nameKey="name">
                  {riskDistributionData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>
      </div>

      <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Medicine Usage</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={medicineUsageData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#0E5C4A" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>
    </section>
  );
};
