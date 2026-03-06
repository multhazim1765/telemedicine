import { useEffect, useMemo, useState } from "react";
import { PharmacyRequest } from "../../types/models";
import { subscribeCollection } from "../../services/firestoreService";

export const SmsLogsViewPage = () => {
  const [requests, setRequests] = useState<PharmacyRequest[]>([]);

  useEffect(() => {
    const unsub = subscribeCollection("pharmacy_requests", setRequests);
    return unsub;
  }, []);

  const logs = useMemo(
    () => requests.filter((item) => item.smsDeliveryStatus || item.smsMessageId),
    [requests]
  );

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <h2 className="mb-3 text-base font-semibold text-slate-800">SMS Logs (View Only)</h2>
      <div className="space-y-2 text-sm">
        {logs.map((log) => (
          <article key={log.id} className="rounded-lg bg-slate-50 p-3">
            <p>Request ID: {log.id}</p>
            <p>Phone: {log.patientPhone}</p>
            <p>Status: {log.smsDeliveryStatus ?? "pending"}</p>
            <p>Message ID: {log.smsMessageId ?? "N/A"}</p>
            {log.smsError && <p className="text-rose-600">Error: {log.smsError}</p>}
          </article>
        ))}
      </div>
    </section>
  );
};
