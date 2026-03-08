import indiaMedicineCatalogJson from "./indiaMedicineCatalog.json";

export type TriageOption = "Emergency" | "Urgent" | "Moderate" | "Mild" | "Routine";

export interface MedicineRule {
  id: string;
  medicineName: string;
  category: string;
  triageOption: TriageOption;
}

export interface TriageRule {
  id: string;
  condition: string;
  category: string;
  triageOption: TriageOption;
  requiredSymptoms: string[];
}

export interface RiskRule {
  id: string;
  description: string;
  weight: number;
  escalatesTo?: "low" | "moderate" | "high";
}

const normalizeToken = (value: string): string => value.trim().toLowerCase();
const MEDICINE_RULE_LIMIT = 2500;

interface CatalogRow {
  id: string;
  medicineName: string;
  therapeuticClass: string;
  uses: string[];
  substitutes: string[];
}

const toSafeString = (value: unknown): string => {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  return "";
};

const toSafeArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => toSafeString(item)).filter(Boolean);
  }
  const single = toSafeString(value);
  return single ? [single] : [];
};

const normalizeCatalogRows = (rows: unknown[]): CatalogRow[] =>
  rows
    .map((raw, index) => {
      const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      return {
        id: toSafeString(record.id) || `IND-${index + 1}`,
        medicineName: toSafeString(record.medicineName) || `Unknown Medicine ${index + 1}`,
        therapeuticClass: toSafeString(record.therapeuticClass) || "General",
        uses: toSafeArray(record.uses),
        substitutes: toSafeArray(record.substitutes)
      };
    })
    .filter((row) => Boolean(row.medicineName));

const catalogRows: CatalogRow[] = normalizeCatalogRows(indiaMedicineCatalogJson as unknown[]).slice(0, MEDICINE_RULE_LIMIT);

const inferCategory = (useText: string, therapeuticClass: string): string => {
  const combined = `${useText} ${therapeuticClass}`.toLowerCase();

  if (combined.includes("infection") || combined.includes("anti infective")) return "Infection";
  if (combined.includes("cough") || combined.includes("respiratory") || combined.includes("asthma")) return "Respiratory";
  if (combined.includes("fever") || combined.includes("viral")) return "Fever";
  if (combined.includes("cardiac") || combined.includes("heart") || combined.includes("chest")) return "Cardiac";
  if (combined.includes("diabetes") || combined.includes("insulin")) return "Diabetes";
  if (combined.includes("pain") || combined.includes("analgesic")) return "Pain Relief";
  if (combined.includes("gastric") || combined.includes("acidity") || combined.includes("stomach")) return "Gastric";
  if (combined.includes("allergy") || combined.includes("rash")) return "Allergy";
  return therapeuticClass || "General";
};

const inferTriageOption = (useText: string, therapeuticClass: string): TriageOption => {
  const combined = `${useText} ${therapeuticClass}`.toLowerCase();

  if (/(anaphylaxis|shock|seizure|stroke|heart attack|myocardial|intensive)/.test(combined)) {
    return "Emergency";
  }
  if (/(severe|acute|infection|antibiotic|respiratory|asthma|breathing)/.test(combined)) {
    return "Urgent";
  }
  if (/(hypertension|diabetes|thyroid|cardiac|cholesterol|gastric|bp)/.test(combined)) {
    return "Moderate";
  }
  if (/(fever|allergy|cough|cold|vomiting|nausea|pain)/.test(combined)) {
    return "Mild";
  }
  return "Routine";
};

export const medicineRules: MedicineRule[] = catalogRows.map((entry) => {
  const useText = `${entry.therapeuticClass} ${entry.uses.join(" ")}`.trim();
  const category = inferCategory(useText, entry.therapeuticClass);
  return {
    id: entry.id,
    medicineName: entry.medicineName,
    category,
    triageOption: inferTriageOption(useText, entry.therapeuticClass)
  } as MedicineRule;
});

const symptomKeywordMap: Array<{ pattern: RegExp; symptom: string }> = [
  { pattern: /(fever|pyrexia|viral)/i, symptom: "fever" },
  { pattern: /(pain|analgesic|arthritis|myalgia)/i, symptom: "body pain" },
  { pattern: /(headache|migraine)/i, symptom: "headache" },
  { pattern: /(cough|cold|bronch|respiratory)/i, symptom: "cough" },
  { pattern: /(breath|asthma|wheez|dyspnea)/i, symptom: "breathing difficulty" },
  { pattern: /(throat|pharyng|tonsil)/i, symptom: "sore throat" },
  { pattern: /(allergy|allergic|rash|itch|urticaria)/i, symptom: "rash" },
  { pattern: /(swelling|edema)/i, symptom: "swelling" },
  { pattern: /(vomit|nausea|emesis)/i, symptom: "nausea" },
  { pattern: /(diarrhea|loose stool|gastro|acidity|gastric|indigestion)/i, symptom: "stomach discomfort" },
  { pattern: /(cardiac|heart|hypertension|bp|angina|chest)/i, symptom: "chest pain" },
  { pattern: /(weakness|fatigue|supplement|nutrition)/i, symptom: "weakness" },
  { pattern: /(dizziness|vertigo)/i, symptom: "dizziness" }
];

const fallbackSymptomsByCategory: Record<string, string[]> = {
  Infection: ["fever", "weakness", "body pain"],
  Respiratory: ["cough", "breathing difficulty", "sore throat"],
  Fever: ["fever", "body pain", "weakness"],
  Cardiac: ["chest pain", "breathing difficulty", "dizziness"],
  Diabetes: ["weakness", "dizziness", "fatigue"],
  "Pain Relief": ["body pain", "headache", "weakness"],
  Gastric: ["stomach discomfort", "nausea", "weakness"],
  Allergy: ["rash", "swelling", "itching"],
  General: ["weakness", "fatigue", "body pain"]
};

const triagePriority: Record<TriageOption, number> = {
  Emergency: 5,
  Urgent: 4,
  Moderate: 3,
  Mild: 2,
  Routine: 1
};

const toTitleCase = (value: string): string =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

const extractSymptoms = (text: string, category: string): string[] => {
  const matches = symptomKeywordMap
    .filter((entry) => entry.pattern.test(text))
    .map((entry) => entry.symptom);

  const unique = Array.from(new Set(matches));
  if (unique.length >= 3) {
    return unique.slice(0, 4);
  }

  const fallback = fallbackSymptomsByCategory[category] ?? fallbackSymptomsByCategory.General;
  return Array.from(new Set([...unique, ...fallback])).slice(0, 4);
};

const triageRuleMap = new Map<string, TriageRule>();

for (const row of catalogRows) {
  const useText = `${row.therapeuticClass} ${row.uses.join(" ")}`.trim();
  const category = inferCategory(useText, row.therapeuticClass);
  const triageOption = inferTriageOption(useText, row.therapeuticClass);
  const condition = toTitleCase(row.therapeuticClass || category || row.medicineName);
  const requiredSymptoms = extractSymptoms(useText, category);

  const key = `${normalizeToken(condition)}|${triageOption}|${requiredSymptoms.map(normalizeToken).join("|")}`;
  const existing = triageRuleMap.get(key);
  if (existing) {
    continue;
  }

  triageRuleMap.set(key, {
    id: `TR-${String(triageRuleMap.size + 1).padStart(4, "0")}`,
    condition,
    category,
    triageOption,
    requiredSymptoms
  });
}

export const triageRules: TriageRule[] = Array.from(triageRuleMap.values()).sort((a, b) => {
  const triageDiff = triagePriority[b.triageOption] - triagePriority[a.triageOption];
  if (triageDiff !== 0) {
    return triageDiff;
  }
  return a.condition.localeCompare(b.condition);
});

export const riskRules: RiskRule[] = [
  { id: "RR001", description: "Symptoms match >= 70% of a triage rule", weight: 20 },
  { id: "RR002", description: "Age > 60 with comorbidity", weight: 20, escalatesTo: "high" },
  { id: "RR003", description: "Fever duration > 3 days", weight: 15, escalatesTo: "moderate" },
  { id: "RR004", description: "Chest pain with breathing difficulty", weight: 35, escalatesTo: "high" }
];

export const defaultDosageByTriage: Record<TriageOption, string> = {
  Emergency: "Immediate as per protocol",
  Urgent: "1 dose now, then every 12 hours",
  Moderate: "1 tablet twice daily",
  Mild: "1 tablet after food when needed",
  Routine: "1 tablet daily"
};

export const medicineAlternatives: Record<string, string[]> = {};

const medicineIdByName = new Map(
  medicineRules.map((rule) => [normalizeToken(rule.medicineName), rule.id])
);

for (const entry of catalogRows) {
  if (entry.substitutes.length > 0) {
    medicineAlternatives[entry.id] = entry.substitutes
      .map((name) => medicineIdByName.get(normalizeToken(name)))
      .filter((value): value is string => Boolean(value))
      .slice(0, 3)
  }
}
