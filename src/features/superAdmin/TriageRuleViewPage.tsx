import { triageRules } from "../../data/medicineTriageDataset";

export const TriageRuleViewPage = () => {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <h2 className="mb-3 text-base font-semibold text-slate-800">Triage Rule View (Read Only)</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="px-2 py-2">Condition</th>
              <th className="px-2 py-2">Category</th>
              <th className="px-2 py-2">Triage</th>
              <th className="px-2 py-2">Symptoms</th>
            </tr>
          </thead>
          <tbody>
            {triageRules.map((rule) => (
              <tr key={rule.id} className="border-t border-slate-100">
                <td className="px-2 py-2">{rule.condition}</td>
                <td className="px-2 py-2">{rule.category}</td>
                <td className="px-2 py-2">{rule.triageOption}</td>
                <td className="px-2 py-2">{rule.requiredSymptoms.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
