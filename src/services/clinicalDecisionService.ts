import { MedicineStock, Patient, TriageSession } from "../types/models";
import {
  defaultDosageByTriage,
  medicineAlternatives,
  medicineRules,
  riskRules,
  triageRules,
  TriageOption
} from "../data/medicineTriageDataset";

export interface SymptomMatchResult {
  ruleId: string;
  condition: string;
  category: string;
  triageOption: TriageOption;
  matchedSymptoms: string[];
  matchPercent: number;
}

export interface RiskResult {
  riskScore: number;
  riskLevel: "low" | "moderate" | "high";
  reasons: string[];
}

export interface SuggestedMedicine {
  medicineId: string;
  medicineName: string;
  category: string;
  triageOption: TriageOption;
  suggestedDosage: string;
  inStock: boolean;
  alternativeMedicineNames: string[];
  explanation: string;
}

const normalizeToken = (value: string): string => value.trim().toLowerCase();

const symptomIncludes = (symptoms: string[], token: string): boolean => {
  const normalizedToken = normalizeToken(token);
  return symptoms.some((symptom) => normalizeToken(symptom).includes(normalizedToken));
};

export const calculateSymptomMatch = (symptoms: string[]): SymptomMatchResult[] => {
  const normalizedSymptoms = symptoms.map(normalizeToken);

  return triageRules
    .map((rule) => {
      const matchedSymptoms = rule.requiredSymptoms.filter((required) =>
        symptomIncludes(normalizedSymptoms, required)
      );
      const matchPercent = Math.round((matchedSymptoms.length / rule.requiredSymptoms.length) * 100);
      return {
        ruleId: rule.id,
        condition: rule.condition,
        category: rule.category,
        triageOption: rule.triageOption,
        matchedSymptoms,
        matchPercent
      };
    })
    .filter((item) => item.matchPercent >= 70)
    .sort((a, b) => b.matchPercent - a.matchPercent);
};

const triageOptionToBaseScore = (triageOption: TriageOption): number => {
  switch (triageOption) {
    case "Emergency":
      return 75;
    case "Urgent":
      return 60;
    case "Moderate":
      return 45;
    case "Mild":
      return 25;
    default:
      return 15;
  }
};

export const calculateRiskStratification = (input: {
  symptoms: string[];
  matchedRule?: SymptomMatchResult;
  age?: number;
  comorbidities?: string[];
  feverDays?: number;
}): RiskResult => {
  const reasons: string[] = [];
  let riskScore = triageOptionToBaseScore(input.matchedRule?.triageOption ?? "Mild");
  let riskLevel: "low" | "moderate" | "high" = riskScore >= 70 ? "high" : riskScore >= 40 ? "moderate" : "low";

  if (input.matchedRule && input.matchedRule.matchPercent >= 70) {
    riskScore += 20;
    reasons.push(`${riskRules[0].description}: ${input.matchedRule.matchPercent}%`);
  }

  const hasComorbidity = (input.comorbidities ?? []).length > 0;
  if ((input.age ?? 0) > 60 && hasComorbidity) {
    riskScore += 20;
    riskLevel = "high";
    reasons.push(riskRules[1].description);
  }

  if ((input.feverDays ?? 0) > 3) {
    riskScore += 15;
    if (riskLevel === "low") {
      riskLevel = "moderate";
    }
    reasons.push(riskRules[2].description);
  }

  const hasChestPain = symptomIncludes(input.symptoms, "chest pain");
  const hasBreathingDifficulty = symptomIncludes(input.symptoms, "breathing difficulty");
  if (hasChestPain && hasBreathingDifficulty) {
    riskScore += 35;
    riskLevel = "high";
    reasons.push(riskRules[3].description);
  }

  return {
    riskScore: Math.min(100, riskScore),
    riskLevel,
    reasons
  };
};

const getStockByMedicineId = (stocks: MedicineStock[]): Record<string, MedicineStock> => {
  return stocks.reduce<Record<string, MedicineStock>>((acc, stock) => {
    acc[stock.medicineId] = stock;
    return acc;
  }, {});
};

const getAlternativeNames = (
  medicineId: string,
  stockMap: Record<string, MedicineStock>
): string[] => {
  const linkedAlternatives = medicineAlternatives[medicineId] ?? [];
  return linkedAlternatives
    .map((altId) => {
      const stock = stockMap[altId];
      if (stock?.inStock) {
        return stock.medicineName;
      }

      const rule = medicineRules.find((entry) => entry.id === altId);
      return rule?.medicineName;
    })
    .filter((name): name is string => Boolean(name));
};

const isAllergic = (allergies: string[], medicineName: string, category: string): boolean => {
  const normalizedAllergies = allergies.map(normalizeToken);
  return normalizedAllergies.some((allergy) =>
    normalizeToken(medicineName).includes(allergy) || normalizeToken(category).includes(allergy)
  );
};

export const suggestMedicines = (input: {
  matchedRule?: SymptomMatchResult;
  riskLevel: "low" | "moderate" | "high";
  patientAllergies?: string[];
  stocks: MedicineStock[];
}): SuggestedMedicine[] => {
  const targetTriage = input.matchedRule?.triageOption;
  const stockMap = getStockByMedicineId(input.stocks);
  const allergies = input.patientAllergies ?? [];

  const triageRank: Record<TriageOption, number> = {
    Emergency: 5,
    Urgent: 4,
    Moderate: 3,
    Mild: 2,
    Routine: 1
  };

  const riskThreshold = input.riskLevel === "high" ? 4 : input.riskLevel === "moderate" ? 3 : 1;

  return medicineRules
    .filter((rule) => {
      if (targetTriage && rule.triageOption !== targetTriage && triageRank[rule.triageOption] < riskThreshold) {
        return false;
      }

      if (input.matchedRule?.category) {
        const sameCategory = normalizeToken(rule.category).includes(normalizeToken(input.matchedRule.category));
        const sameTriage = rule.triageOption === input.matchedRule.triageOption;
        return sameCategory || sameTriage;
      }

      return triageRank[rule.triageOption] >= riskThreshold;
    })
    .filter((rule) => !isAllergic(allergies, rule.medicineName, rule.category))
    .slice(0, 6)
    .map((rule) => {
      const stock = stockMap[rule.id];
      const inStock = stock ? stock.inStock && stock.quantity > 0 : true;
      const alternativeMedicineNames = inStock
        ? []
        : [
            ...new Set([
              ...(stock?.alternatives ?? []),
              ...getAlternativeNames(rule.id, stockMap)
            ])
          ];

      return {
        medicineId: rule.id,
        medicineName: rule.medicineName,
        category: rule.category,
        triageOption: rule.triageOption,
        suggestedDosage: defaultDosageByTriage[rule.triageOption],
        inStock,
        alternativeMedicineNames,
        explanation: input.matchedRule
          ? `Suggested because symptoms matched: ${input.matchedRule.matchedSymptoms.join(" + ")}`
          : `Suggested from ${rule.triageOption} triage rule`
      };
    });
};

export const runClinicalDecisionSupport = (input: {
  session: TriageSession;
  patient?: Patient;
  feverDays?: number;
  stocks: MedicineStock[];
}) => {
  const matches = calculateSymptomMatch(input.session.symptoms);
  const topMatch = matches[0];
  const risk = calculateRiskStratification({
    symptoms: input.session.symptoms,
    matchedRule: topMatch,
    age: input.patient?.age,
    comorbidities: input.patient?.comorbidities,
    feverDays: input.feverDays
  });

  const medicines = suggestMedicines({
    matchedRule: topMatch,
    riskLevel: risk.riskLevel,
    patientAllergies: input.patient?.allergies,
    stocks: input.stocks
  });

  return {
    match: topMatch,
    allMatches: matches,
    risk,
    medicines
  };
};

export const buildPrescriptionSmsTemplate = (input: {
  medicines: Array<{ medicine: string; dosage: string }>;
  reviewAfterDays: number;
}): string => {
  const medicineLines = input.medicines
    .map((item) => `${item.medicine} - ${item.dosage}`)
    .join("\n");

  return [
    "Civil Hospital PHC:",
    "Prescription:",
    medicineLines,
    `Review after ${input.reviewAfterDays} days.`,
    "If symptoms worsen, visit hospital immediately."
  ].join("\n");
};
