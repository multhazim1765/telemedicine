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

export const medicineRules: MedicineRule[] = [
  { id: "M016", medicineName: "Adrenaline Injection", category: "Anaphylaxis", triageOption: "Emergency" },
  { id: "M017", medicineName: "Atropine Injection", category: "Cardiac Emergency", triageOption: "Emergency" },
  { id: "M018", medicineName: "Dopamine Injection", category: "Shock", triageOption: "Emergency" },
  { id: "M019", medicineName: "Ceftriaxone Injection", category: "Severe Infection", triageOption: "Emergency" },
  { id: "M020", medicineName: "Nitroglycerin", category: "Cardiac", triageOption: "Emergency" },
  { id: "M021", medicineName: "Streptokinase", category: "Heart Attack", triageOption: "Emergency" },
  { id: "M022", medicineName: "Diazepam Injection", category: "Seizures", triageOption: "Emergency" },
  { id: "M023", medicineName: "Magnesium Sulphate", category: "Eclampsia", triageOption: "Emergency" },
  { id: "M024", medicineName: "Insulin", category: "Diabetes", triageOption: "Urgent" },
  { id: "M025", medicineName: "Salbutamol Inhaler", category: "Asthma", triageOption: "Urgent" },
  { id: "M026", medicineName: "Amoxicillin 500mg", category: "Antibiotic", triageOption: "Urgent" },
  { id: "M027", medicineName: "Azithromycin", category: "Antibiotic", triageOption: "Urgent" },
  { id: "M028", medicineName: "Metronidazole", category: "Infection", triageOption: "Urgent" },
  { id: "M029", medicineName: "Prednisolone", category: "Inflammation", triageOption: "Urgent" },
  { id: "M030", medicineName: "Furosemide", category: "Cardiac / Kidney", triageOption: "Urgent" },
  { id: "M031", medicineName: "Tramadol", category: "Severe Pain", triageOption: "Urgent" },
  { id: "M032", medicineName: "Metformin 500mg", category: "Diabetes", triageOption: "Moderate" },
  { id: "M033", medicineName: "Atorvastatin 10mg", category: "Cholesterol", triageOption: "Moderate" },
  { id: "M034", medicineName: "Diclofenac", category: "Pain Relief", triageOption: "Moderate" },
  { id: "M035", medicineName: "Amlodipine", category: "Hypertension", triageOption: "Moderate" },
  { id: "M036", medicineName: "Losartan", category: "Hypertension", triageOption: "Moderate" },
  { id: "M037", medicineName: "Levothyroxine", category: "Thyroid", triageOption: "Moderate" },
  { id: "M038", medicineName: "Clopidogrel", category: "Cardiac", triageOption: "Moderate" },
  { id: "M039", medicineName: "Pantoprazole 40mg", category: "Gastric", triageOption: "Moderate" },
  { id: "M040", medicineName: "Paracetamol 500mg", category: "Fever", triageOption: "Mild" },
  { id: "M041", medicineName: "Cetirizine", category: "Allergy", triageOption: "Mild" },
  { id: "M042", medicineName: "ORS", category: "Dehydration", triageOption: "Mild" },
  { id: "M043", medicineName: "Zinc Tablets", category: "Immunity", triageOption: "Mild" },
  { id: "M044", medicineName: "Vitamin C", category: "Supplement", triageOption: "Mild" },
  { id: "M045", medicineName: "Ondansetron", category: "Vomiting", triageOption: "Mild" },
  { id: "M046", medicineName: "Antacid Syrup", category: "Gastric", triageOption: "Mild" },
  { id: "M047", medicineName: "Cough Syrup", category: "Respiratory", triageOption: "Mild" },
  { id: "M048", medicineName: "Vitamin D", category: "Supplement", triageOption: "Routine" },
  { id: "M049", medicineName: "Calcium Tablets", category: "Supplement", triageOption: "Routine" },
  { id: "M050", medicineName: "Iron Tablets", category: "Anemia", triageOption: "Routine" },
  { id: "M051", medicineName: "Folic Acid", category: "Pregnancy", triageOption: "Routine" },
  { id: "M052", medicineName: "Multivitamin", category: "Supplement", triageOption: "Routine" },
  { id: "M053", medicineName: "Omega-3", category: "Cardiac Prevention", triageOption: "Routine" },
  { id: "M054", medicineName: "Probiotics", category: "Digestive Health", triageOption: "Routine" }
];

export const triageRules: TriageRule[] = [
  { id: "TR001", condition: "Anaphylaxis", category: "Anaphylaxis", triageOption: "Emergency", requiredSymptoms: ["rash", "swelling", "breathing difficulty"] },
  { id: "TR002", condition: "Cardiac Emergency", category: "Cardiac Emergency", triageOption: "Emergency", requiredSymptoms: ["chest pain", "breathing difficulty", "sweating"] },
  { id: "TR003", condition: "Shock", category: "Shock", triageOption: "Emergency", requiredSymptoms: ["low bp", "dizziness", "cold skin"] },
  { id: "TR004", condition: "Severe Infection", category: "Severe Infection", triageOption: "Emergency", requiredSymptoms: ["high fever", "chills", "weakness"] },
  { id: "TR005", condition: "Asthma Exacerbation", category: "Asthma", triageOption: "Urgent", requiredSymptoms: ["wheezing", "breathing difficulty", "cough"] },
  { id: "TR006", condition: "Acute Infection", category: "Infection", triageOption: "Urgent", requiredSymptoms: ["fever", "body pain", "sore throat"] },
  { id: "TR007", condition: "Hypertension", category: "Hypertension", triageOption: "Moderate", requiredSymptoms: ["headache", "giddiness", "high bp"] },
  { id: "TR008", condition: "Gastritis", category: "Gastric", triageOption: "Moderate", requiredSymptoms: ["acidity", "burning stomach", "nausea"] },
  { id: "TR009", condition: "Viral Fever", category: "Fever", triageOption: "Mild", requiredSymptoms: ["fever", "body pain", "fatigue"] },
  { id: "TR010", condition: "Common Allergy", category: "Allergy", triageOption: "Mild", requiredSymptoms: ["sneezing", "itching", "rash"] },
  { id: "TR011", condition: "Nutritional Support", category: "Supplement", triageOption: "Routine", requiredSymptoms: ["fatigue", "weakness", "poor appetite"] },
  { id: "TR012", condition: "Digestive Support", category: "Digestive Health", triageOption: "Routine", requiredSymptoms: ["bloating", "indigestion", "loose stools"] }
];

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

export const medicineAlternatives: Record<string, string[]> = {
  M026: ["M027"],
  M027: ["M026"],
  M035: ["M036"],
  M036: ["M035"],
  M044: ["M052"],
  M052: ["M044"],
  M048: ["M049"],
  M049: ["M048"]
};
