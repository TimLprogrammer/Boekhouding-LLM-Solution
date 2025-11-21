import { supabase } from './supabaseClient';
import { Company, Invoice, Project, Expense, Investment, Shareholder, PaymentStatus } from '../types';

// Helper om errors te loggen
const handleError = (error: any, context: string) => {
  if (error) {
    console.error(`Supabase Error in ${context}:`, error);
    throw error;
  }
};

export const DataService = {
  // --- Companies ---
  getCompanies: async (): Promise<Company[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase.from('companies').select('*');
    handleError(error, 'getCompanies');
    return data || [];
  },
  addCompany: async (c: Partial<Company>) => {
    if (!supabase) return;
    const { error } = await supabase.from('companies').insert(c);
    handleError(error, 'addCompany');
  },
  updateCompany: async (id: string, c: Partial<Company>) => {
    if (!supabase) return;
    const { error } = await supabase.from('companies').update(c).eq('id', id);
    handleError(error, 'updateCompany');
  },
  deleteCompany: async (id: string) => {
    if (!supabase) return;
    const { error } = await supabase.from('companies').delete().eq('id', id);
    handleError(error, 'deleteCompany');
  },

  // --- Projects ---
  getProjects: async (): Promise<Project[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase.from('projects').select('*');
    handleError(error, 'getProjects');
    return data || [];
  },
  addProject: async (p: Partial<Project>) => {
    if (!supabase) return;
    const { error } = await supabase.from('projects').insert(p);
    handleError(error, 'addProject');
  },
  updateProject: async (id: string, p: Partial<Project>) => {
      if (!supabase) return;
      const { error } = await supabase.from('projects').update(p).eq('id', id);
      handleError(error, 'updateProject');
  },

  // --- Invoices ---
  getInvoices: async (): Promise<Invoice[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase.from('invoices').select('*');
    handleError(error, 'getInvoices');
    return data || [];
  },
  addInvoice: async (inv: Partial<Invoice>) => {
    if (!supabase) return;
    const { error } = await supabase.from('invoices').insert(inv);
    handleError(error, 'addInvoice');
  },
  updateInvoiceStatus: async (id: string, status: PaymentStatus) => {
      if (!supabase) return;
      const { error } = await supabase.from('invoices').update({ status }).eq('id', id);
      handleError(error, 'updateInvoiceStatus');
  },

  // --- Expenses ---
  getExpenses: async (): Promise<Expense[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase.from('expenses').select('*');
    handleError(error, 'getExpenses');
    return data || [];
  },
  addExpense: async (e: Partial<Expense>) => {
    if (!supabase) return;
    const { error } = await supabase.from('expenses').insert(e);
    handleError(error, 'addExpense');
  },

  // --- Investments ---
  getInvestments: async (): Promise<Investment[]> => {
      if (!supabase) return [];
      const { data, error } = await supabase.from('investments').select('*');
      handleError(error, 'getInvestments');
      return data || [];
  },
  addInvestment: async (inv: Partial<Investment>) => {
      if (!supabase) return;
      const { error } = await supabase.from('investments').insert(inv);
      handleError(error, 'addInvestment');
  },

  // --- Shareholders ---
  getShareholders: async (): Promise<Shareholder[]> => {
      if (!supabase) return [];
      const { data, error } = await supabase.from('shareholders').select('*');
      handleError(error, 'getShareholders');
      return data || [];
  },
  updateShareholder: async (id: string, sh: Partial<Shareholder>) => {
      if (!supabase) return;
      const { error } = await supabase.from('shareholders').update(sh).eq('id', id);
      handleError(error, 'updateShareholder');
  }
};
