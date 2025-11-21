
export enum VATRate {
  ZERO = 0,
  LOW = 9,
  HIGH = 21,
}

export enum InvoiceType {
  SALES = 'VERKOOP',
  PURCHASE = 'INKOOP',
}

export enum PaymentStatus {
  DRAFT = 'CONCEPT',
  SENT = 'VERSTUURD',
  PARTIAL = 'DEELS_BETAALD',
  PAID = 'BETAALD',
  OVERDUE = 'VERVALLEN',
}

export enum CompanyType {
  CLIENT = 'KLANT',
  SUPPLIER = 'LEVERANCIER',
  INTERNAL = 'INTERN',
}

export interface Address {
  street: string;
  number: string;
  zip: string;
  city: string;
  country: string;
}

export interface Company {
  id: string;
  name: string;
  type: CompanyType;
  kvk?: string;
  btw?: string;
  address: Address;
  email?: string;
}

export interface Shareholder {
  id: string;
  name: string;
  defaultPercentage: number; // 0-100
}

export interface InvoiceLine {
  id: string;
  description: string;
  amount: number; // Excl VAT
  vatRate: VATRate;
}

export interface Invoice {
  id: string;
  number: string; // INV-YYYY-MM-###
  type: InvoiceType;
  companyId: string;
  projectId?: string;
  date: string;
  dueDate: string;
  status: PaymentStatus;
  lines: InvoiceLine[];
  shareholderSplit: Record<string, number>; // ShareholderID -> Percentage
  attachmentUrl?: string; // Legacy URL (optional)
  fileData?: string; // Base64 string
  fileName?: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  date: string;
  description: string;
  category: string;
  amountExcl: number;
  vatAmount: number;
  companyId?: string;
  projectId?: string;
  receiptUrl?: string;
  fileData?: string;
  fileName?: string;
}

export interface Investment {
  id: string;
  description: string;
  date: string;
  purchaseValue: number;
  residualValue: number;
  lifespanYears: number;
  category: 'HARDWARE' | 'SOFTWARE' | 'INVENTARIS' | 'VOERTUIGEN' | 'OVERIG';
  receiptUrl?: string;
  fileData?: string;
  fileName?: string;
}

export interface Project {
  id: string;
  name: string;
  companyId: string;
  startDate: string;
  endDate?: string;
  status: 'ACTIEF' | 'VOLTOOID' | 'GEARCHIVEERD';
  leadShareholderId?: string; // 'BOTH' or UUID
}

export interface Settings {
  key: string;
  value: any;
}

export interface FinancialSummary {
    revenue: number;
    expenses: number;
    investments: number;
    profit: number;
    vatPayable: number;
    vatDeductible: number;
    vatTotal: number;
    kiaDeduction: number;
    manualCorrection: number; // From settings
}

export interface VatReport {
    period: string; // 'Q1', 'Q2', 'Q3', 'Q4'
    year: number;
    turnoverHigh: number; // 1a
    vatHigh: number;
    turnoverLow: number; // 1b
    vatLow: number;
    vatDeductible: number; // 5b
    totalPayable: number;
}
