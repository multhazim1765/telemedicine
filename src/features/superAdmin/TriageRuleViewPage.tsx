import { useMemo, useState } from "react";
import { triageRules } from "../../data/medicineTriageDataset";

export const TriageRuleViewPage = () => {
  const [searchText, setSearchText] = useState("");

  const filteredRules = useMemo(() => {
    const token = searchText.trim().toLowerCase();
    if (!token) {
      return triageRules;
    }

    return triageRules.filter((rule) => {
      const searchable = `${rule.condition} ${rule.category} ${rule.triageOption} ${rule.requiredSymptoms.join(" ")}`.toLowerCase();
      return searchable.includes(token);
    });
  }, [searchText]);

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <h2 className="mb-3 text-base font-semibold text-slate-800">Triage Rule View (Read Only)</h2>
      <div className="mb-3 grid gap-2 md:grid-cols-[1fr_auto]">
        <input
          className="input"
          placeholder="Search condition, category, triage, symptom"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
        />
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          Rules: <span className="font-semibold">{filteredRules.length.toLocaleString()}</span>
        </div>
      </div>
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
            {filteredRules.map((rule) => (
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
