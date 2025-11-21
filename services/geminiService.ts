import { GoogleGenAI } from "@google/genai";
import { FinancialSummary } from "../types";

// Safe access to process.env
const getApiKey = () => {
  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env) {
      // @ts-ignore
      return process.env.API_KEY || '';
    }
  } catch (e) {
    return '';
  }
  return '';
};

const API_KEY = getApiKey();

// Safe initialization
let ai: GoogleGenAI | null = null;
try {
    if (API_KEY) {
        ai = new GoogleGenAI({ apiKey: API_KEY });
    }
} catch (error) {
    console.error("Failed to initialize Gemini client", error);
}

export const getFinancialAdvice = async (summary: FinancialSummary, context: string): Promise<string> => {
  if (!ai) return "Gemini API key niet gevonden of geconfigureerd.";

  const prompt = `
    Je bent een strikte, zakelijke Nederlandse belastingadviseur voor een VOF genaamd "LLM Solution".
    
    Financiële Context:
    - Omzet: €${summary.revenue.toFixed(2)}
    - Kosten: €${summary.expenses.toFixed(2)}
    - Investeringen: €${summary.investments.toFixed(2)}
    - Winst: €${summary.profit.toFixed(2)}
    - Te betalen BTW: €${summary.vatPayable.toFixed(2)}
    - Te vorderen BTW: €${summary.vatDeductible.toFixed(2)}
    - Netto BTW positie: €${summary.vatTotal.toFixed(2)}

    Gebruikersvraag/Context: "${context}"

    Geef beknopt, tekst-gebaseerd advies. Focus op:
    1. Liquiditeit voor de aankomende BTW aangifte.
    2. Potentiële belastingvoordelen (zoals KOR of KIA indien relevant op basis van bedragen).
    3. Risico's.
    
    Houd de toon formeel en minimalistisch. Gebruik geen markdown formatting behalve newlines.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "Geen advies gegenereerd.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Er is een fout opgetreden bij het ophalen van advies.";
  }
};