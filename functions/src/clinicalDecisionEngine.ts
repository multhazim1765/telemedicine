type RiskLevel = "low" | "moderate" | "high";

type TriageOption = "Emergency" | "Urgent" | "Moderate" | "Mild" | "Routine";

interface BackendTriageRule {
  id: string;
  condition: string;
  triageOption: TriageOption;
  requiredSymptoms: string[];
}

interface BackendMedicineRule {
  id: string;
  medicineName: string;
  category: string;
  triageOption: TriageOption;
}

interface BackendStock {
  medicineId: string;
  quantity: number;
  inStock: boolean;
  alternatives: string[];
}

interface BackendDecisionInput {
  symptoms: string[];
  age: number;
  comorbidities: string[];
  allergies: string[];
  feverDays: number;
  stocks: BackendStock[];
}

export const backendTriageRules: BackendTriageRule[] = [
  { id: "TR001", condition: "Anaphylaxis", triageOption: "Emergency", requiredSymptoms: ["rash", "swelling", "breathing difficulty"] },
  { id: "TR002", condition: "Cardiac Emergency", triageOption: "Emergency", requiredSymptoms: ["chest pain", "breathing difficulty", "sweating"] },
  { id: "TR006", condition: "Acute Infection", triageOption: "Urgent", requiredSymptoms: ["fever", "body pain", "sore throat"] },
  { id: "TR009", condition: "Viral Fever", triageOption: "Mild", requiredSymptoms: ["fever", "body pain", "fatigue"] }
];

export const backendMedicineRules: BackendMedicineRule[] = [
  { id: "M040", medicineName: "Paracetamol 500mg", category: "Fever", triageOption: "Mild" },
  { id: "M026", medicineName: "Amoxicillin 500mg", category: "Antibiotic", triageOption: "Urgent" },
  { id: "M027", medicineName: "Azithromycin", category: "Antibiotic", triageOption: "Urgent" },
  { id: "M020", medicineName: "Nitroglycerin", category: "Cardiac", triageOption: "Emergency" }
];

const includesSymptom = (symptoms: string[], token: string): boolean => {
  const normalizedToken = token.toLowerCase().trim();
  return symptoms.some((entry) => entry.toLowerCase().includes(normalizedToken));
};

export const matchSymptoms = (symptoms: string[]) => {
  return backendTriageRules
    .map((rule) => {
      const matched = rule.requiredSymptoms.filter((required) => includesSymptom(symptoms, required));
      const score = (matched.length / rule.requiredSymptoms.length) * 100;
      return { rule, matched, score };
    })
    .filter((entry) => entry.score >= 70)
    .sort((a, b) => b.score - a.score);
};

const triageBase = (triageOption: TriageOption): number => {
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

export const scoreRisk = (input: BackendDecisionInput, triageOption: TriageOption): { riskScore: number; riskLevel: RiskLevel; reasons: string[] } => {
  let riskScore = triageBase(triageOption);
  let riskLevel: RiskLevel = riskScore >= 70 ? "high" : riskScore >= 40 ? "moderate" : "low";
  const reasons: string[] = [];

  if (input.age > 60 && input.comorbidities.length > 0) {
    riskScore += 20;
    riskLevel = "high";
    reasons.push("Age > 60 + comorbidity");
  }

  if (input.feverDays > 3) {
    riskScore += 15;
    if (riskLevel === "low") {
      riskLevel = "moderate";
    }
    reasons.push("Fever > 3 days");
  }

  if (includesSymptom(input.symptoms, "chest pain") && includesSymptom(input.symptoms, "breathing difficulty")) {
    riskScore += 35;
    riskLevel = "high";
    reasons.push("Chest pain + breathing difficulty");
  }

  return { riskScore: Math.min(100, riskScore), riskLevel, reasons };
};

export const filterMedicines = (input: BackendDecisionInput, triageOption: TriageOption) => {
  const stockMap = input.stocks.reduce<Record<string, BackendStock>>((acc, stock) => {
    acc[stock.medicineId] = stock;
    return acc;
  }, {});

  return backendMedicineRules
    .filter((rule) => rule.triageOption === triageOption)
    .filter((rule) => {
      const allergyTokens = input.allergies.map((entry) => entry.toLowerCase());
      return !allergyTokens.some((allergy) => rule.medicineName.toLowerCase().includes(allergy) || rule.category.toLowerCase().includes(allergy));
    })
    .map((rule) => {
      const stock = stockMap[rule.id];
      const inStock = stock ? stock.inStock && stock.quantity > 0 : true;
      const alternatives = inStock ? [] : stock?.alternatives ?? [];
      return { ...rule, inStock, alternatives };
    });
};

export const runBackendCDS = (input: BackendDecisionInput) => {
  const matches = matchSymptoms(input.symptoms);
  const top = matches[0];
  const triageOption = top?.rule.triageOption ?? "Mild";
  const risk = scoreRisk(input, triageOption);
  const medicines = filterMedicines(input, triageOption);

  return {
    condition: top?.rule.condition ?? "General symptomatic care",
    symptomMatchPercent: Math.round(top?.score ?? 0),
    explainability: top ? `Suggested because symptoms matched: ${top.matched.join(" + ")}` : "No >=70% rule match",
    risk,
    medicines
  };
};
