import { TriageResult } from "../types/models";

const symptomRiskMap: Record<string, number> = {
  chest_pain: 5,
  breathlessness: 5,
  high_fever: 3,
  prolonged_fever: 3,
  vomiting: 2,
  severe_headache: 2,
  bleeding: 5,
  weakness: 2,
  cough: 1,
  sore_throat: 1
};

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
  symptoms.reduce((sum, symptom) => sum + (symptomRiskMap[symptom] ?? 1), 0);

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
