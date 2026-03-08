import { TriageResult } from "../types/models";
import { triageRules, TriageOption } from "../data/medicineTriageDataset";

const triageWeight: Record<TriageOption, number> = {
  Emergency: 5,
  Urgent: 4,
  Moderate: 3,
  Mild: 2,
  Routine: 1
};

const normalizeSymptom = (symptom: string): string =>
  symptom.trim().toLowerCase().replace(/\s+/g, "_");

const symptomRiskMap: Record<string, number> = triageRules.reduce<Record<string, number>>((acc, rule) => {
  for (const symptom of rule.requiredSymptoms) {
    const normalized = normalizeSymptom(symptom);
    acc[normalized] = Math.max(acc[normalized] ?? 0, triageWeight[rule.triageOption]);
  }
  return acc;
}, {
  fever: 3,
  weakness: 2,
  cough: 1,
  "body_pain": 2,
  "breathing_difficulty": 4
});

const classify = (score: number): TriageResult["severityLevel"] => {
  if (score >= 7) {
    return "high";
  }
  if (score >= 4) {
    return "medium";
  }
  return "low";
};

const actionByLevel = (level: TriageResult["severityLevel"]): string => {
  if (level === "high") {
    return "Immediate doctor consultation or nearest emergency center";
  }
  if (level === "medium") {
    return "Book same-day teleconsultation with general physician";
  }
  return "Home care guidance and schedule routine checkup";
};

const scoreSymptomsOffline = (symptoms: string[]): number =>
  symptoms.reduce((sum, symptom) => {
    const normalized = normalizeSymptom(symptom);
    const directScore = symptomRiskMap[normalized];
    if (directScore) {
      return sum + directScore;
    }

    const matchedEntry = Object.entries(symptomRiskMap).find(([token]) => normalized.includes(token));
    return sum + (matchedEntry?.[1] ?? 1);
  }, 0);

const triageWithOpenAI = async (symptoms: string[]): Promise<TriageResult | null> => {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  const model = import.meta.env.VITE_OPENAI_MODEL ?? "gpt-4o-mini";
  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        input: `Return only strict JSON with keys severityScore:number severityLevel:(low|medium|high) recommendedAction:string for symptoms: ${symptoms.join(", ")}`,
        max_output_tokens: 120
      })
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    const text = payload.output_text as string | undefined;
    if (!text) {
      return null;
    }

    const result = JSON.parse(text) as TriageResult;
    if (!["low", "medium", "high"].includes(result.severityLevel)) {
      return null;
    }

    return result;
  } catch {
    return null;
  }
};

export const triageAgent = async (symptoms: string[]): Promise<TriageResult> => {
  if (navigator.onLine) {
    const aiResult = await triageWithOpenAI(symptoms);
    if (aiResult) {
      return aiResult;
    }
  }

  const severityScore = scoreSymptomsOffline(symptoms);
  const severityLevel = classify(severityScore);
  return {
    severityScore,
    severityLevel,
    recommendedAction: actionByLevel(severityLevel)
  };
};
