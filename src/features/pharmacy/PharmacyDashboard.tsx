import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { DashboardLayout } from "../../components/DashboardLayout";
import { subscribeCollection } from "../../services/firestoreService";
import { MedicineStock, PharmacyRequest, Prescription } from "../../types/models";
import { updatePharmacyAvailability } from "../../agents/pharmacyAgent";

export const PharmacyDashboard = () => {
  const [requests, setRequests] = useState<PharmacyRequest[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [stocks, setStocks] = useState<MedicineStock[]>([]);
  const [phoneFilter, setPhoneFilter] = useState("");
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "in">("all");
  const [stockSearch, setStockSearch] = useState("");

  useEffect(() => {
    const unsubRequests = subscribeCollection("pharmacy_requests", setRequests);
    const unsubPrescriptions = subscribeCollection("prescriptions", setPrescriptions);
    const unsubStocks = subscribeCollection("medicine_stock", setStocks);
    return () => {
      unsubRequests();
      unsubPrescriptions();
      unsubStocks();
    };
  }, []);

  const filteredRequests = useMemo(() => {
    if (!phoneFilter.trim()) {
      return requests;
    }
    return requests.filter((request) => request.patientPhone.includes(phoneFilter.trim()));
  }, [phoneFilter, requests]);

  const getPrescription = (prescriptionId: string): Prescription | undefined =>
    prescriptions.find((item) => item.id === prescriptionId);

  const filteredStocks = useMemo(() => {
    return stocks.filter((stock) => {
      const matchesText =
        stock.medicineName.toLowerCase().includes(stockSearch.toLowerCase()) ||
        stock.medicineId.toLowerCase().includes(stockSearch.toLowerCase());

      if (!matchesText) {
        return false;
      }

      if (stockFilter === "low") {
        return stock.quantity > 0 && stock.quantity <= 10;
      }

      if (stockFilter === "in") {
        return stock.inStock && stock.quantity > 0;
      }

      return true;
    });
  }, [stocks, stockFilter, stockSearch]);

  return (
    <DashboardLayout title="Pharmacy Dashboard">
      <section className="card mb-4">
        <h2 className="mb-3 text-base font-semibold">Medicine Stock</h2>
        <div className="mb-3 grid gap-2 md:grid-cols-[1fr_auto]">
          <input
            className="input"
            type="text"
            placeholder="Search medicine name or ID"
            value={stockSearch}
            onChange={(event) => setStockSearch(event.target.value)}
          />
          <select className="input md:w-44" value={stockFilter} onChange={(event) => setStockFilter(event.target.value as "all" | "low" | "in") }>
            <option value="all">All stock</option>
            <option value="low">Low stock</option>
            <option value="in">In stock</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="px-2 py-2">Medicine</th>
                <th className="px-2 py-2">ID</th>
                <th className="px-2 py-2">Quantity</th>
                <th className="px-2 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredStocks.map((stock) => {
                const lowStock = stock.quantity <= 10;
                return (
                  <motion.tr
                    key={stock.id}
                    className={`border-t border-slate-200 ${lowStock ? "bg-amber-50" : "bg-white"}`}
                    animate={lowStock ? { opacity: [1, 0.7, 1] } : { opacity: 1 }}
                    transition={lowStock ? { duration: 1.2, repeat: Infinity } : { duration: 0.2 }}
                  >
                    <td className="px-2 py-2">{stock.medicineName}</td>
                    <td className="px-2 py-2">{stock.medicineId}</td>
                    <td className="px-2 py-2">{stock.quantity}</td>
                    <td className="px-2 py-2">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${stock.inStock && stock.quantity > 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                        {stock.inStock && stock.quantity > 0 ? "Available" : "Out of stock"}
                      </span>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2 className="mb-2 text-base font-semibold">Pharmacy Requests</h2>
        <input
          className="input mb-3"
          type="text"
          placeholder="Search by patient mobile number"
          value={phoneFilter}
          onChange={(event) => setPhoneFilter(event.target.value)}
        />
        <div className="space-y-3">
          {filteredRequests.map((request) => {
            const prescription = getPrescription(request.prescriptionId);
            return (
            <article key={request.id} className="rounded-md bg-slate-100 p-3 text-sm">
              <p>Patient Mobile: <span className="font-medium">{request.patientPhone}</span></p>
              <p className="font-medium">Medicines: {request.medicines.join(", ") || "N/A"}</p>
              <p>Prescription Notes: {prescription?.notes ?? "N/A"}</p>
              <p>Current SMS status: {request.smsStatus}</p>
              <div className="mt-2 flex gap-2">
                <button
                  className="btn-primary"
                  onClick={() => void updatePharmacyAvailability(request.id, true)}
                >
                  Mark Available
                </button>
                <button
                  className="btn-muted"
                  onClick={() => void updatePharmacyAvailability(request.id, false)}
                >
                  Mark Not Available
                </button>
              </div>
            </article>
            );
          })}
        </div>
      </section>
    </DashboardLayout>
  );
};
