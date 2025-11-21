
import { supabase } from './supabaseClient';
import { Company, Invoice, Project, Expense, Investment, Shareholder, PaymentStatus, InvoiceType } from '../types';

// Helper om errors te loggen
const handleError = (error: any, context: string) => {
  if (error) {
    console.error(`Supabase Error in ${context}:`, error.message || JSON.stringify(error));
    throw error;
  }
};

// Helper om undefined values te verwijderen voor insert/update
const clean = (obj: any) => {
  Object.keys(obj).forEach(key => obj[key] === undefined && delete obj[key]);
  return obj;
};

// --- MAPPING FUNCTIONS (CamelCase <-> Snake_case) ---

const toDbCompany = (c: Partial<Company>) => clean({
    id: c.id,
    name: c.name,
    type: c.type,
    kvk: c.kvk,
    btw: c.btw,
    address: c.address,
    email: c.email
});

const fromDbCompany = (row: any): Company => ({
    id: row.id,
    name: row.name,
    type: row.type,
    kvk: row.kvk,
    btw: row.btw,
    address: row.address || { street: '', number: '', zip: '', city: '', country: 'NL' },
    email: row.email
});

const toDbProject = (p: Partial<Project>) => clean({
    name: p.name,
    company_id: p.companyId,
    status: p.status,
    start_date: p.startDate,
    end_date: p.endDate,
    lead_shareholder_id: p.leadShareholderId === 'BOTH' ? null : p.leadShareholderId
});

const fromDbProject = (row: any): Project => ({
    id: row.id,
    name: row.name,
    companyId: row.company_id,
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    leadShareholderId: row.lead_shareholder_id || 'BOTH'
});

const toDbInvoice = (i: Partial<Invoice>) => clean({
    number: i.number,
    type: i.type,
    company_id: i.companyId,
    project_id: i.projectId,
    date: i.date,
    due_date: i.dueDate,
    status: i.status,
    lines: i.lines,
    shareholder_split: i.shareholderSplit,
    attachment_url: i.attachmentUrl,
    file_data: i.fileData,
    file_name: i.fileName
});

const fromDbInvoice = (row: any): Invoice => ({
    id: row.id,
    number: row.number,
    type: row.type,
    companyId: row.company_id,
    projectId: row.project_id,
    date: row.date,
    dueDate: row.due_date,
    status: row.status,
    lines: row.lines || [],
    shareholderSplit: row.shareholder_split || {},
    attachmentUrl: row.attachment_url,
    fileData: row.file_data,
    fileName: row.file_name,
    createdAt: row.created_at
});

const toDbExpense = (e: Partial<Expense>) => clean({
    date: e.date,
    description: e.description,
    category: e.category,
    amount_excl: e.amountExcl,
    vat_amount: e.vatAmount,
    company_id: e.companyId,
    project_id: e.projectId,
    receipt_url: e.receiptUrl,
    file_data: e.fileData,
    file_name: e.fileName
});

const fromDbExpense = (row: any): Expense => ({
    id: row.id,
    date: row.date,
    description: row.description,
    category: row.category,
    amountExcl: row.amount_excl,
    vatAmount: row.vat_amount,
    companyId: row.company_id,
    projectId: row.project_id,
    receiptUrl: row.receipt_url,
    fileData: row.file_data,
    fileName: row.file_name
});

const toDbInvestment = (i: Partial<Investment>) => clean({
    description: i.description,
    date: i.date,
    purchase_value: i.purchaseValue,
    residual_value: i.residualValue,
    lifespan_years: i.lifespanYears,
    category: i.category,
    receipt_url: i.receiptUrl,
    file_data: i.fileData,
    file_name: i.fileName
});

const fromDbInvestment = (row: any): Investment => ({
    id: row.id,
    description: row.description,
    date: row.date,
    purchaseValue: row.purchase_value,
    residualValue: row.residual_value,
    lifespanYears: row.lifespan_years,
    category: row.category,
    receiptUrl: row.receipt_url,
    fileData: row.file_data,
    fileName: row.file_name
});

const toDbShareholder = (s: Partial<Shareholder>) => clean({
    id: s.id,
    name: s.name,
    default_percentage: s.defaultPercentage
});

const fromDbShareholder = (row: any): Shareholder => ({
    id: row.id,
    name: row.name,
    defaultPercentage: row.default_percentage
});

// --- SERVICE METHODS ---

export const DataService = {
  // --- Companies ---
  getCompanies: async (): Promise<Company[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase.from('companies').select('*');
    handleError(error, 'getCompanies');
    return (data || []).map(fromDbCompany);
  },
  addCompany: async (c: Partial<Company>) => {
    if (!supabase) return;
    const dbData = toDbCompany(c);
    if (!dbData.id) delete dbData.id; 
    const { error } = await supabase.from('companies').insert(dbData);
    handleError(error, 'addCompany');
  },
  updateCompany: async (id: string, c: Partial<Company>) => {
    if (!supabase) return;
    const { error } = await supabase.from('companies').update(toDbCompany(c)).eq('id', id);
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
    return (data || []).map(fromDbProject);
  },
  addProject: async (p: Partial<Project>) => {
    if (!supabase) return;
    const { error } = await supabase.from('projects').insert(toDbProject(p));
    handleError(error, 'addProject');
  },
  updateProject: async (id: string, p: Partial<Project>) => {
      if (!supabase) return;
      const { error } = await supabase.from('projects').update(toDbProject(p)).eq('id', id);
      handleError(error, 'updateProject');
  },

  // --- Invoices ---
  getInvoices: async (): Promise<Invoice[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase.from('invoices').select('*');
    handleError(error, 'getInvoices');
    return (data || []).map(fromDbInvoice);
  },
  addInvoice: async (inv: Partial<Invoice>) => {
    if (!supabase) return;
    const { error } = await supabase.from('invoices').insert(toDbInvoice(inv));
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
    return (data || []).map(fromDbExpense);
  },
  addExpense: async (e: Partial<Expense>) => {
    if (!supabase) return;
    const { error } = await supabase.from('expenses').insert(toDbExpense(e));
    handleError(error, 'addExpense');
  },

  // --- Investments ---
  getInvestments: async (): Promise<Investment[]> => {
      if (!supabase) return [];
      const { data, error } = await supabase.from('investments').select('*');
      handleError(error, 'getInvestments');
      return (data || []).map(fromDbInvestment);
  },
  addInvestment: async (inv: Partial<Investment>) => {
      if (!supabase) return;
      const { error } = await supabase.from('investments').insert(toDbInvestment(inv));
      handleError(error, 'addInvestment');
  },

  // --- Shareholders ---
  getShareholders: async (): Promise<Shareholder[]> => {
      if (!supabase) return [];
      const { data, error } = await supabase.from('shareholders').select('*');
      handleError(error, 'getShareholders');
      return (data || []).map(fromDbShareholder);
  },
  addShareholder: async (sh: Shareholder) => {
      if (!supabase) return;
      const { error } = await supabase.from('shareholders').insert(toDbShareholder(sh));
      handleError(error, 'addShareholder');
  },
  updateShareholder: async (id: string, sh: Partial<Shareholder>) => {
      if (!supabase) return;
      const { error } = await supabase.from('shareholders').update(toDbShareholder(sh)).eq('id', id);
      handleError(error, 'updateShareholder');
  },
  deleteShareholder: async (id: string) => {
      if (!supabase) return;
      const { error } = await supabase.from('shareholders').delete().eq('id', id);
      handleError(error, 'deleteShareholder');
  },

  // --- Settings ---
  getSettings: async (key: string): Promise<any> => {
      if (!supabase) return null;
      const { data, error } = await supabase.from('settings').select('value').eq('key', key).single();
      if (error && error.code !== 'PGRST116') console.error(error);
      return data?.value || null;
  },
  updateSettings: async (key: string, value: any) => {
      if (!supabase) return;
      const { error } = await supabase.from('settings').upsert({ key, value });
      handleError(error, 'updateSettings');
  },

  // --- Export ---
  downloadPeriodArchive: async (year: number, quarter: number, range: string[]) => {
    if (!supabase) return;
    const startDate = `${year}-${range[0]}-01`;
    const endDate = `${year}-${range[1]}-31`;

    const { data: invoices } = await supabase.from('invoices')
        .select('*').gte('date', startDate).lte('date', endDate);
    
    const { data: expenses } = await supabase.from('expenses')
        .select('*').gte('date', startDate).lte('date', endDate);

    const { data: investments } = await supabase.from('investments')
        .select('*').gte('date', startDate).lte('date', endDate);

    // Initialize JSZip
    // @ts-ignore
    if (typeof window.JSZip === 'undefined') {
        alert("JSZip library not loaded.");
        return;
    }
    // @ts-ignore
    const zip = new window.JSZip();
    const folder = zip.folder(`Boekhouding_${year}_Q${quarter}`);

    // Process Invoices
    invoices?.forEach((inv: any) => {
        if (inv.file_data) {
            const fileName = inv.file_name || `INV_${inv.number}.pdf`;
            const base64Data = inv.file_data.split(',')[1] || inv.file_data;
            folder?.file(`Verkoop/${fileName}`, base64Data, { base64: true });
        }
    });

    // Process Expenses
    expenses?.forEach((exp: any) => {
        if (exp.file_data) {
            const fileName = exp.file_name || `UITG_${exp.date}_${exp.description.replace(/[^a-z0-9]/gi, '_')}.pdf`;
            const base64Data = exp.file_data.split(',')[1] || exp.file_data;
            folder?.file(`Kosten/${fileName}`, base64Data, { base64: true });
        }
    });

    // Process Investments
    investments?.forEach((inv: any) => {
        if (inv.file_data) {
            const fileName = inv.file_name || `INV_${inv.date}_${inv.description.replace(/[^a-z0-9]/gi, '_')}.pdf`;
            const base64Data = inv.file_data.split(',')[1] || inv.file_data;
            folder?.file(`Investeringen/${fileName}`, base64Data, { base64: true });
        }
    });

    // Generate and Download
    zip?.generateAsync({ type: "blob" }).then((content: Blob) => {
        const url = window.URL.createObjectURL(content);
        const a = document.createElement("a");
        a.href = url;
        a.download = `LLM_Solution_Q${quarter}_${year}.zip`;
        a.click();
    });
  }
};
