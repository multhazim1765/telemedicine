import { Prescription } from "../types/models";

type PrescriptionDraft = Pick<Prescription, "medicines" | "dosageInstructions" | "notes">;

export const prescriptionAgent = (consultationNotes: string): PrescriptionDraft => {
  const lines = consultationNotes
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const medicines = lines
    .filter((line) => line.toLowerCase().startsWith("med:"))
    .map((line) => line.replace(/^med:/i, "").trim());

  const dosageInstructions = lines
    .filter((line) => line.toLowerCase().startsWith("dose:"))
    .map((line) => line.replace(/^dose:/i, "").trim());

  return {
    medicines,
    dosageInstructions,
    notes: consultationNotes
  };
};
