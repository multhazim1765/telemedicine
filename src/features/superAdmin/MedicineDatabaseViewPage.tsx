import { medicineRules } from "../../data/medicineTriageDataset";

export const MedicineDatabaseViewPage = () => {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <h2 className="mb-3 text-base font-semibold text-slate-800">Medicine Database View (Read Only)</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="px-2 py-2">ID</th>
              <th className="px-2 py-2">Medicine</th>
              <th className="px-2 py-2">Category</th>
              <th className="px-2 py-2">Triage Option</th>
            </tr>
          </thead>
          <tbody>
            {medicineRules.map((medicine) => (
              <tr key={medicine.id} className="border-t border-slate-100">
                <td className="px-2 py-2">{medicine.id}</td>
                <td className="px-2 py-2">{medicine.medicineName}</td>
                <td className="px-2 py-2">{medicine.category}</td>
                <td className="px-2 py-2">{medicine.triageOption}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
