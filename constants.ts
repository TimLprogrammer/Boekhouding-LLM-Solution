export const APP_NAME = "LLM Solution Boekhouding";

export const COLORS = {
  orange: '#ED7D31',
  taupe: '#6C5F5B',
  brown: '#4F4A45',
  cream: '#F6F1EE',
};

export const EXPENSE_CATEGORIES = [
  "Kantoor",
  "Marketing",
  "Reiskosten",
  "Verzekering",
  "Software Licenties",
  "Administratie",
  "Bankkosten",
  "Overig",
];

export const INVESTMENT_CATEGORIES = [
  "Hardware",
  "Software",
  "Inventaris",
  "Voertuigen",
  "Overig"
];

export const DEFAULT_SHAREHOLDERS = [
  { id: 'sh_1', name: 'Partner A', defaultPercentage: 50 },
  { id: 'sh_2', name: 'Partner B', defaultPercentage: 50 },
];

// Dutch tax year constants (KIA 2024)
export const KIA_THRESHOLD_MIN = 2801; 
export const KIA_MIN_ITEM_VALUE = 450; // Minimum value per investment to count
export const KIA_BRACKET_1_MAX = 69765;
export const KIA_BRACKET_2_MAX = 129194;
export const KIA_BRACKET_3_MAX = 387580;

export const KIA_PCT_LOW = 0.28; // 28%
export const KIA_FIXED_MID = 19535; // Fixed amount
export const KIA_REDUCTION_PCT = 0.0756; // Reduction percentage for highest bracket