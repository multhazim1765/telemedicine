import { useEffect, useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { subscribeCollection } from "../../services/firestoreService";
import { Appointment, PharmacyRequest } from "../../types/models";

export const AnalyticsPage = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [requests, setRequests] = useState<PharmacyRequest[]>([]);

  useEffect(() => {
    const unsubAppointments = subscribeCollection("appointments", setAppointments);
    const unsubRequests = subscribeCollection("pharmacy_requests", setRequests);
    return () => {
      unsubAppointments();
      unsubRequests();
    };
  }, []);

  const smsData = useMemo(() => {
    const sent = requests.filter((item) => item.smsDeliveryStatus === "sent").length;
    const failed = requests.filter((item) => item.smsDeliveryStatus === "failed").length;
    const pending = requests.filter((item) => !item.smsDeliveryStatus || item.smsDeliveryStatus === "pending").length;
    return [
      { name: "Sent", value: sent, color: "#2BB673" },
      { name: "Failed", value: failed, color: "#ef4444" },
      { name: "Pending", value: pending, color: "#f59e0b" }
    ];
  }, [requests]);

  const appointmentBySlot = useMemo(() => {
    const slots = appointments.reduce<Record<string, number>>((acc, item) => {
      acc[item.slot] = (acc[item.slot] ?? 0) + 1;
      return acc;
    }, {});
    return Object.entries(slots).map(([name, value]) => ({ name, value }));
  }, [appointments]);

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">SMS Delivery Mix</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={smsData} dataKey="value" nameKey="name" outerRadius={90}>
                {smsData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Appointments By Slot</h3>
        <ul className="space-y-2 text-sm">
          {appointmentBySlot.map((entry) => (
            <li key={entry.name} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <span>{entry.name}</span>
              <span className="font-semibold text-slate-800">{entry.value}</span>
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
};
