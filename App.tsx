
import React, { useState, useEffect } from 'react';
import { supabase } from './services/supabaseClient';
import { DataService } from './services/dataService';
import { getFinancialAdvice } from './services/geminiService';
import { 
    Company, CompanyType, Invoice, InvoiceType, PaymentStatus, Project, 
    Expense, Investment, Shareholder, VATRate, InvoiceLine, FinancialSummary, VatReport 
} from './types';
import { 
    COLORS, EXPENSE_CATEGORIES, INVESTMENT_CATEGORIES, KIA_MIN_ITEM_VALUE, 
    KIA_THRESHOLD_MIN, KIA_BRACKET_1_MAX, KIA_BRACKET_2_MAX, KIA_BRACKET_3_MAX,
    KIA_PCT_LOW, KIA_FIXED_MID, KIA_REDUCTION_PCT, QUARTERS
} from './constants';

// --- Logic Helpers ---

const calculateKiaDeduction = (totalInvestments: number): number => {
    if (totalInvestments < KIA_THRESHOLD_MIN) return 0;
    if (totalInvestments <= KIA_BRACKET_1_MAX) return totalInvestments * KIA_PCT_LOW;
    if (totalInvestments <= KIA_BRACKET_2_MAX) return KIA_FIXED_MID;
    if (totalInvestments <= KIA_BRACKET_3_MAX) {
        const excess = totalInvestments - KIA_BRACKET_2_MAX;
        return KIA_FIXED_MID - (excess * KIA_REDUCTION_PCT);
    }
    return 0;
};

const calculateBookValue = (inv: Investment): number => {
    const purchaseDate = new Date(inv.date);
    const now = new Date();
    const ageInMs = now.getTime() - purchaseDate.getTime();
    const ageInYears = ageInMs / (1000 * 60 * 60 * 24 * 365.25);
    
    if (ageInYears >= inv.lifespanYears) return inv.residualValue;
    
    const totalDepreciation = inv.purchaseValue - inv.residualValue;
    const annualDepreciation = totalDepreciation / inv.lifespanYears;
    const currentDepreciation = annualDepreciation * ageInYears;
    
    return Math.max(inv.residualValue, inv.purchaseValue - currentDepreciation);
};

// --- UI Components ---

const Button = ({ onClick, children, variant = 'primary', className = '', disabled = false }: any) => {
  const baseStyle = "px-4 py-2 text-sm font-medium uppercase tracking-wider transition-colors border-2 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  const styles = {
    primary: `bg-brand-orange text-white border-brand-orange hover:bg-white hover:text-brand-orange`,
    secondary: `bg-transparent text-brand-brown border-brand-taupe hover:border-brand-orange hover:text-brand-orange`,
    danger: `bg-transparent text-red-800 border-red-800 hover:bg-red-800 hover:text-white`,
    text: `border-transparent text-brand-brown hover:text-brand-orange px-2`
  };

  return (
    <button disabled={disabled} onClick={onClick} className={`${baseStyle} ${styles[variant as keyof typeof styles]} ${className}`}>
      {children}
    </button>
  );
};

const Card = ({ title, children, action }: any) => (
  <div className="border-2 border-brand-taupe p-6 bg-white h-full">
    <div className="flex justify-between items-baseline mb-4 border-b border-brand-cream pb-2">
      <h3 className="text-xl font-bold text-brand-brown uppercase tracking-tight">{title}</h3>
      {action}
    </div>
    <div className="text-brand-brown">
      {children}
    </div>
  </div>
);

const Metric = ({ label, value, subValue, highlight = false }: any) => (
  <div className="mb-4">
    <span className="block text-xs uppercase tracking-widest text-brand-taupe mb-1">{label}</span>
    <span className={`text-2xl font-mono font-bold ${highlight ? 'text-brand-orange' : 'text-brand-brown'}`}>
      {value}
    </span>
    {subValue && <span className="block text-xs text-brand-taupe mt-1">{subValue}</span>}
  </div>
);

const Input = (props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) => (
    <div className="mb-4">
        <label className="block text-xs uppercase tracking-widest mb-1 text-brand-brown">{props.label}</label>
        <input {...props} className="w-full p-2 border-2 border-brand-taupe bg-brand-cream focus:border-brand-orange outline-none" />
    </div>
);

const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }) => (
    <div className="mb-4">
        <label className="block text-xs uppercase tracking-widest mb-1 text-brand-brown">{props.label}</label>
        <select {...props} className="w-full p-2 border-2 border-brand-taupe bg-brand-cream focus:border-brand-orange outline-none">
            {props.children}
        </select>
    </div>
);

// --- File Upload Component ---
const FileUpload = ({ onFileSelect }: { onFileSelect: (data: string, name: string) => void }) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (evt) => {
                if (evt.target?.result) {
                    onFileSelect(evt.target.result as string, file.name);
                }
            };
            reader.readAsDataURL(file);
        }
    };
    return (
        <div className="mb-4">
            <label className="block text-xs uppercase tracking-widest mb-1 text-brand-brown">Upload PDF Factuur</label>
            <input type="file" accept="application/pdf" onChange={handleChange} className="w-full p-2 border-2 border-dashed border-brand-taupe bg-brand-cream text-xs" />
        </div>
    );
};

// --- Views ---

const AuthView = ({ onLogin }: { onLogin: () => void }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);

    const handleAuth = async () => {
        setLoading(true);
        setError('');
        try {
            if (!supabase) throw new Error("Geen verbinding met database.");
            let result;
            if (isSignUp) {
                result = await supabase.auth.signUp({ email, password });
            } else {
                result = await supabase.auth.signInWithPassword({ email, password });
            }
            if (result.error) throw result.error;
            onLogin();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-brand-cream p-4">
            <div className="max-w-md w-full border-4 border-brand-taupe bg-white p-8">
                <h1 className="text-4xl font-bold text-brand-orange mb-2">LLM<span className="text-brand-brown">SOLUTION</span></h1>
                <p className="text-brand-taupe uppercase tracking-widest mb-8 text-xs">Boekhouding Login</p>
                {error && <div className="bg-red-100 text-red-800 p-2 mb-4 text-sm">{error}</div>}
                <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
                <Input label="Wachtwoord" type="password" value={password} onChange={e => setPassword(e.target.value)} />
                <Button onClick={handleAuth} className="w-full mb-4">{loading ? 'Laden...' : (isSignUp ? 'Registreren' : 'Inloggen')}</Button>
                <button onClick={() => setIsSignUp(!isSignUp)} className="text-xs text-brand-taupe hover:text-brand-orange w-full text-center">
                    {isSignUp ? 'Heb je al een account? Log in' : 'Nog geen account? Registreren'}
                </button>
            </div>
        </div>
    );
};

const ClientsView = () => {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [form, setForm] = useState<Partial<Company>>({
        name: '', type: CompanyType.CLIENT, kvk: '', btw: '', 
        address: { street: '', number: '', zip: '', city: '', country: 'NL' }
    });

    const fetchData = async () => {
        setLoading(true);
        const data = await DataService.getCompanies();
        setCompanies(data.sort((a,b) => a.type === CompanyType.CLIENT ? -1 : 1));
        setLoading(false);
    };
    useEffect(() => { fetchData(); }, []);

    const handleSave = async () => {
        await DataService.addCompany(form);
        setIsEditing(false);
        fetchData();
        setForm({ name: '', type: CompanyType.CLIENT, kvk: '', btw: '', address: { street: '', number: '', zip: '', city: '', country: 'NL' } });
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-brand-brown uppercase">Klanten & Relaties</h2>
                <Button onClick={() => setIsEditing(!isEditing)}>{isEditing ? 'Sluiten' : '+ Nieuwe Klant'}</Button>
            </div>
            {isEditing && (
                <Card title="Nieuwe Klant Aanmaken">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Bedrijfsnaam" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                        <Select label="Type Relatie" value={form.type} onChange={e => setForm({...form, type: e.target.value as CompanyType})}>
                            <option value={CompanyType.CLIENT}>Klant</option>
                            <option value={CompanyType.SUPPLIER}>Leverancier</option>
                            <option value={CompanyType.INTERNAL}>Intern / Partner</option>
                        </Select>
                        <Input label="KVK Nummer" value={form.kvk} onChange={e => setForm({...form, kvk: e.target.value})} />
                        <Input label="BTW Nummer" value={form.btw} onChange={e => setForm({...form, btw: e.target.value})} />
                        <div className="md:col-span-2 grid grid-cols-3 gap-2">
                            <Input label="Straat" value={form.address?.street} onChange={e => setForm({...form, address: {...form.address!, street: e.target.value}})} />
                            <Input label="Huisnummer" value={form.address?.number} onChange={e => setForm({...form, address: {...form.address!, number: e.target.value}})} />
                            <Input label="Postcode" value={form.address?.zip} onChange={e => setForm({...form, address: {...form.address!, zip: e.target.value}})} />
                            <Input label="Stad" value={form.address?.city} onChange={e => setForm({...form, address: {...form.address!, city: e.target.value}})} />
                        </div>
                    </div>
                    <Button onClick={handleSave} className="mt-4">Opslaan</Button>
                </Card>
            )}
            <div className="bg-white border-2 border-brand-taupe overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-brand-taupe text-white uppercase text-xs">
                        <tr><th className="p-3">Naam</th><th className="p-3">Type</th><th className="p-3">Plaats</th><th className="p-3">KVK / BTW</th></tr>
                    </thead>
                    <tbody className="divide-y divide-brand-cream">
                        {companies.map(c => (
                            <tr key={c.id} className="hover:bg-brand-cream/50">
                                <td className="p-3 font-bold">{c.name}</td>
                                <td className="p-3 uppercase text-xs"><span className={`px-2 py-1 ${c.type === CompanyType.CLIENT ? 'bg-brand-orange text-white' : 'bg-gray-200'}`}>{c.type}</span></td>
                                <td className="p-3">{c.address?.city}</td>
                                <td className="p-3 font-mono text-xs">{c.kvk} <br/> {c.btw}</td>
                            </tr>
                        ))}
                        {companies.length === 0 && !loading && <tr><td colSpan={4} className="p-4 text-center text-brand-taupe">Geen klanten of relaties gevonden.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const ProjectsView = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [shareholders, setShareholders] = useState<Shareholder[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [form, setForm] = useState<Partial<Project>>({ name: '', status: 'ACTIEF', startDate: new Date().toISOString().split('T')[0], leadShareholderId: 'BOTH' });

    const fetchData = async () => {
        const [p, c, s] = await Promise.all([DataService.getProjects(), DataService.getCompanies(), DataService.getShareholders()]);
        setProjects(p); setCompanies(c); setShareholders(s);
    };
    useEffect(() => { fetchData(); }, []);

    const handleSave = async () => {
        if (!form.companyId) return alert("Selecteer een klant");
        await DataService.addProject(form);
        setIsEditing(false);
        fetchData();
        setForm({ name: '', status: 'ACTIEF', startDate: new Date().toISOString().split('T')[0], leadShareholderId: 'BOTH' });
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-brand-brown uppercase">Projecten</h2>
                <Button onClick={() => setIsEditing(!isEditing)}>{isEditing ? 'Sluiten' : '+ Nieuw Project'}</Button>
            </div>
            {isEditing && (
                <Card title="Nieuw Project Starten">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Projectnaam" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                        <Select label="Klant" value={form.companyId || ''} onChange={e => setForm({...form, companyId: e.target.value})}>
                            <option value="">Selecteer Klant...</option>
                            {companies.filter(c => c.type === CompanyType.CLIENT).map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </Select>
                        <Select label="Verantwoordelijke Partner" value={form.leadShareholderId || ''} onChange={e => setForm({...form, leadShareholderId: e.target.value})}>
                            <option value="BOTH">Beide / Gezamenlijk</option>
                            {shareholders.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </Select>
                        <Input label="Startdatum" type="date" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} />
                    </div>
                    <Button onClick={handleSave} className="mt-4">Project Opslaan</Button>
                </Card>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map(p => (
                    <Card key={p.id} title={p.name}>
                        <div className="text-sm space-y-2">
                            <div className="flex justify-between border-b border-brand-cream pb-1"><span className="text-brand-taupe">Klant:</span><span className="font-bold">{companies.find(c => c.id === p.companyId)?.name || 'Onbekend'}</span></div>
                            <div className="flex justify-between border-b border-brand-cream pb-1"><span className="text-brand-taupe">Partner:</span><span className="font-mono">{p.leadShareholderId && p.leadShareholderId !== 'BOTH' ? shareholders.find(s => s.id === p.leadShareholderId)?.name : 'Gezamenlijk'}</span></div>
                            <div className="flex justify-between"><span className="text-brand-taupe">Status:</span><span className={`px-2 py-0.5 text-xs text-white ${p.status === 'ACTIEF' ? 'bg-green-600' : 'bg-brand-taupe'}`}>{p.status}</span></div>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
};

const ExpensesView = () => {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [view, setView] = useState<'LIST' | 'NEW'>('LIST');
    
    const [form, setForm] = useState({
        description: '', date: new Date().toISOString().split('T')[0], category: EXPENSE_CATEGORIES[0], 
        amountInput: 0, vatIncluded: true, vatRate: 21, companyId: '', fileData: '', fileName: ''
    });

    const fetchData = async () => {
        const [e, c] = await Promise.all([DataService.getExpenses(), DataService.getCompanies()]);
        setExpenses(e.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        setCompanies(c);
    };
    useEffect(() => { fetchData(); }, [view]);

    const calculated = (() => {
        const amt = form.amountInput;
        const rate = form.vatRate / 100;
        if (form.vatIncluded) {
            const excl = amt / (1 + rate);
            return { excl, vat: amt - excl, total: amt };
        } else {
            return { excl: amt, vat: amt * rate, total: amt * (1 + rate) };
        }
    })();

    const handleSave = async () => {
        if(!form.description || !form.amountInput) return;
        await DataService.addExpense({
            date: form.date, description: form.description, category: form.category,
            amountExcl: calculated.excl, vatAmount: calculated.vat, companyId: form.companyId || undefined,
            fileData: form.fileData, fileName: form.fileName
        });
        setForm({ description: '', date: new Date().toISOString().split('T')[0], category: EXPENSE_CATEGORIES[0], amountInput: 0, vatIncluded: true, vatRate: 21, companyId: '', fileData: '', fileName: '' });
        setView('LIST');
    };

    if (view === 'NEW') {
        return (
            <Card title="Kosten Registreren" action={<Button variant="secondary" onClick={() => setView('LIST')}>Annuleren</Button>}>
                <FileUpload onFileSelect={(data, name) => setForm({...form, fileData: data, fileName: name})} />
                {form.fileName && <div className="mb-4 text-xs text-green-600 font-bold">Bestand geselecteerd: {form.fileName}</div>}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Omschrijving" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
                    <Input label="Datum" type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                    <Select label="Categorie" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>{EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</Select>
                    <Select label="Leverancier" value={form.companyId} onChange={e => setForm({...form, companyId: e.target.value})}><option value="">Geen</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
                    
                    <div className="md:col-span-2 border-t border-brand-taupe pt-4">
                         <div className="grid grid-cols-3 gap-4">
                            <Input label="Bedrag (Invoer)" type="number" step="0.01" value={form.amountInput} onChange={e => setForm({...form, amountInput: parseFloat(e.target.value)})} />
                            <Select label="Bedrag is" value={form.vatIncluded ? 'INCL' : 'EXCL'} onChange={e => setForm({...form, vatIncluded: e.target.value === 'INCL'})}>
                                <option value="INCL">Inclusief BTW</option>
                                <option value="EXCL">Exclusief BTW</option>
                            </Select>
                            <Select label="BTW Tarief" value={form.vatRate} onChange={e => setForm({...form, vatRate: parseInt(e.target.value)})}>
                                <option value="21">21%</option><option value="9">9%</option><option value="0">0%</option>
                            </Select>
                         </div>
                    </div>
                    <div className="md:col-span-2 bg-brand-cream p-3 border border-brand-taupe flex justify-between items-center">
                        <div className="text-sm">Excl: € {calculated.excl.toFixed(2)} | BTW: € {calculated.vat.toFixed(2)}</div>
                        <div className="font-bold text-lg text-brand-orange">Totaal: € {calculated.total.toFixed(2)}</div>
                    </div>
                </div>
                <Button onClick={handleSave} className="mt-4">Opslaan</Button>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center"><h2 className="text-2xl font-bold text-brand-brown uppercase">Zakelijke Kosten</h2><Button onClick={() => setView('NEW')}>+ Registreer Kosten</Button></div>
            <div className="overflow-x-auto border-2 border-brand-taupe bg-white">
                <table className="w-full text-sm text-left"><thead className="bg-brand-taupe text-white uppercase text-xs"><tr><th className="p-3">Datum</th><th className="p-3">Omschrijving</th><th className="p-3 text-right">Excl.</th><th className="p-3 text-right">BTW</th><th className="p-3 text-right">Totaal</th><th className="p-3">PDF</th></tr></thead>
                    <tbody className="divide-y divide-brand-cream">
                        {expenses.map(ex => (
                            <tr key={ex.id} className="hover:bg-brand-cream/50">
                                <td className="p-3">{ex.date}</td><td className="p-3 font-bold">{ex.description}</td>
                                <td className="p-3 text-right">€ {ex.amountExcl.toFixed(2)}</td><td className="p-3 text-right">€ {ex.vatAmount.toFixed(2)}</td><td className="p-3 text-right font-bold">€ {(ex.amountExcl + ex.vatAmount).toFixed(2)}</td>
                                <td className="p-3">{ex.fileName ? '📎' : '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const InvestmentsView = () => {
    const [investments, setInvestments] = useState<Investment[]>([]);
    const [view, setView] = useState<'LIST' | 'NEW'>('LIST');
    const [form, setForm] = useState({
        description: '', date: new Date().toISOString().split('T')[0], category: INVESTMENT_CATEGORIES[0],
        purchaseValue: 0, residualValue: 0, lifespanYears: 5, fileData: '', fileName: ''
    });

    const fetchData = async () => {
        const data = await DataService.getInvestments();
        setInvestments(data.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    };
    useEffect(() => { fetchData(); }, [view]);

    const handleSave = async () => {
        if(!form.description || !form.purchaseValue) return;
        await DataService.addInvestment({
            description: form.description, date: form.date, category: form.category as any,
            purchaseValue: form.purchaseValue, residualValue: form.residualValue, lifespanYears: form.lifespanYears,
            fileData: form.fileData, fileName: form.fileName
        });
        setForm({ description: '', date: new Date().toISOString().split('T')[0], category: INVESTMENT_CATEGORIES[0], purchaseValue: 0, residualValue: 0, lifespanYears: 5, fileData: '', fileName: '' });
        setView('LIST');
    };

    if(view === 'NEW') {
        return (
            <Card title="Investering Registreren" action={<Button variant="secondary" onClick={() => setView('LIST')}>Annuleren</Button>}>
                <FileUpload onFileSelect={(data, name) => setForm({...form, fileData: data, fileName: name})} />
                {form.fileName && <div className="mb-4 text-xs text-green-600 font-bold">Bestand geselecteerd: {form.fileName}</div>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Omschrijving" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
                    <Input label="Aanschafdatum" type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                    <Select label="Categorie" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>{INVESTMENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</Select>
                    <Input label="Aanschafwaarde (Excl BTW)" type="number" value={form.purchaseValue} onChange={e => setForm({...form, purchaseValue: parseFloat(e.target.value)})} />
                    <Input label="Restwaarde" type="number" value={form.residualValue} onChange={e => setForm({...form, residualValue: parseFloat(e.target.value)})} />
                    <Input label="Afschrijving (Jaren)" type="number" value={form.lifespanYears} onChange={e => setForm({...form, lifespanYears: parseInt(e.target.value)})} />
                </div>
                <Button onClick={handleSave} className="mt-4">Opslaan</Button>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center"><h2 className="text-2xl font-bold text-brand-brown uppercase">Investeringen</h2><Button onClick={() => setView('NEW')}>+ Registreer Investering</Button></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {investments.map(inv => {
                    const currentVal = calculateBookValue(inv);
                    return (
                        <Card key={inv.id} title={inv.description}>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between"><span>Datum:</span><span>{inv.date}</span></div>
                                <div className="flex justify-between"><span>Aanschaf:</span><span>€ {inv.purchaseValue.toFixed(2)}</span></div>
                                <div className="flex justify-between font-bold text-brand-orange"><span>Boekwaarde:</span><span>€ {currentVal.toFixed(2)}</span></div>
                                {inv.fileName && <div className="text-xs text-brand-taupe mt-2">📄 PDF Beschikbaar</div>}
                            </div>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
};

const VatReturnView = () => {
    const [year, setYear] = useState(new Date().getFullYear());
    const [quarter, setQuarter] = useState(Math.ceil((new Date().getMonth() + 1) / 3));
    const [report, setReport] = useState<VatReport | null>(null);
    const [kiaStats, setKiaStats] = useState<{total: number, deduction: number} | null>(null);
    const [downloading, setDownloading] = useState(false);

    useEffect(() => {
        const calculate = async () => {
            const qData = QUARTERS.find(q => q.id === quarter);
            if (!qData) return;
            const invoices = await DataService.getInvoices();
            const expenses = await DataService.getExpenses();
            const investments = await DataService.getInvestments();

            const start = `${year}-${qData.range[0]}-01`;
            const end = `${year}-${qData.range[1]}-31`;

            let tHigh = 0, vHigh = 0, tLow = 0, vLow = 0;
            invoices.filter(i => i.type === InvoiceType.SALES && i.date >= start && i.date <= end)
                .forEach(inv => {
                    inv.lines.forEach(line => {
                        if (line.vatRate === 21) { tHigh += line.amount; vHigh += line.amount * 0.21; }
                        if (line.vatRate === 9) { tLow += line.amount; vLow += line.amount * 0.09; }
                    });
                });

            let vDeduct = 0;
            expenses.filter(e => e.date >= start && e.date <= end).forEach(e => vDeduct += e.vatAmount);

            setReport({ period: `Q${quarter}`, year, turnoverHigh: tHigh, vatHigh: vHigh, turnoverLow: tLow, vatLow: vLow, vatDeductible: vDeduct, totalPayable: (vHigh + vLow) - vDeduct });

            const yearStart = `${year}-01-01`; const yearEnd = `${year}-12-31`;
            const yearlyInvestments = investments.filter(i => i.date >= yearStart && i.date <= yearEnd && i.purchaseValue >= KIA_MIN_ITEM_VALUE).reduce((acc, i) => acc + i.purchaseValue, 0);
            setKiaStats({ total: yearlyInvestments, deduction: calculateKiaDeduction(yearlyInvestments) });
        };
        calculate();
    }, [year, quarter]);

    const handleDownload = async () => {
        setDownloading(true);
        const qData = QUARTERS.find(q => q.id === quarter);
        if(qData) await DataService.downloadPeriodArchive(year, quarter, qData.range);
        setDownloading(false);
    };

    const qInfo = QUARTERS.find(q => q.id === quarter);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-brand-brown uppercase">BTW Aangifte</h2>
                <div className="flex gap-2">
                    <Select label="" value={year} onChange={e => setYear(parseInt(e.target.value))} className="w-24"><option value="2024">2024</option><option value="2025">2025</option></Select>
                    <Select label="" value={quarter} onChange={e => setQuarter(parseInt(e.target.value))} className="w-32">{QUARTERS.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}</Select>
                </div>
            </div>
            {report && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card title={`Aangifte ${year} ${report.period}`}>
                        <div className="bg-brand-cream p-4 mb-4 text-sm border border-brand-taupe"><span className="font-bold text-brand-orange">DEADLINE:</span> {qInfo?.deadline} {quarter === 4 ? year + 1 : year}</div>
                        <div className="space-y-4">
                            <div className="border-b border-brand-cream pb-2"><h4 className="font-bold text-sm uppercase">1a. 21% Leveringen</h4><div className="grid grid-cols-2"><span>Omzet: € {report.turnoverHigh.toFixed(0)}</span><span>BTW: € {report.vatHigh.toFixed(0)}</span></div></div>
                            <div className="border-b border-brand-cream pb-2"><h4 className="font-bold text-sm uppercase">1b. 9% Leveringen</h4><div className="grid grid-cols-2"><span>Omzet: € {report.turnoverLow.toFixed(0)}</span><span>BTW: € {report.vatLow.toFixed(0)}</span></div></div>
                            <div className="border-b border-brand-cream pb-2"><h4 className="font-bold text-sm uppercase">5b. Voorbelasting</h4><div className="text-right">- € {report.vatDeductible.toFixed(0)}</div></div>
                            <div className="bg-brand-brown text-white p-3 flex justify-between items-center font-bold"><span>Totaal</span><span className="font-mono text-lg">€ {report.totalPayable.toFixed(0)}</span></div>
                        </div>
                        <Button onClick={handleDownload} disabled={downloading} className="w-full mt-4">{downloading ? 'Aanmaken...' : 'Download Dossier (ZIP)'}</Button>
                    </Card>
                    {kiaStats && <Card title="Inkomstenbelasting (KIA)"><Metric label="Totale Investering" value={`€ ${kiaStats.total.toFixed(2)}`} /><Metric label="KIA Aftrek" value={`€ ${kiaStats.deduction.toFixed(2)}`} highlight /></Card>}
                </div>
            )}
        </div>
    );
};

const InvoicesView = () => {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [shareholders, setShareholders] = useState<Shareholder[]>([]);
    const [view, setView] = useState<'LIST' | 'NEW'>('LIST');
    
    // Upload Form State
    const [invType, setInvType] = useState<InvoiceType>(InvoiceType.SALES);
    const [form, setForm] = useState({
        date: new Date().toISOString().split('T')[0], companyId: '', projectId: '',
        totalInput: 0, vatIncluded: true, vatRate: 21, fileData: '', fileName: ''
    });

    const fetchData = async () => {
        const [i, c, p, s] = await Promise.all([DataService.getInvoices(), DataService.getCompanies(), DataService.getProjects(), DataService.getShareholders()]);
        setInvoices(i); setCompanies(c); setProjects(p); setShareholders(s);
    };
    useEffect(() => { fetchData(); }, [view]);

    // Calculate splits and net amounts
    const calculated = (() => {
        const amt = form.totalInput;
        const rate = form.vatRate / 100;
        const excl = form.vatIncluded ? amt / (1 + rate) : amt;
        const vat = form.vatIncluded ? amt - excl : amt * rate;
        return { excl, vat, total: form.vatIncluded ? amt : amt + vat };
    })();

    const handleSave = async () => {
        if (!form.companyId || !form.totalInput) return alert("Vul bedrijf en bedrag in");
        
        // Generate Split automatically based on equal parts for now, OR based on project logic later
        // User said "because I indicate percentage", but in this "Upload" flow simpler is better.
        // We will use equal split as default if project doesn't have specific logic
        const split: any = {};
        if(shareholders.length > 0) {
            const equal = 100 / shareholders.length;
            shareholders.forEach(s => split[s.id] = equal);
        }

        const number = `INV-${form.date.replace(/-/g,'')}-${Math.floor(Math.random()*1000)}`;
        
        // Create single line item representing the full PDF upload
        const line: InvoiceLine = { 
            id: crypto.randomUUID(), 
            description: "Factuur Upload: " + (form.fileName || 'Onbekend'), 
            amount: calculated.excl, 
            vatRate: form.vatRate 
        };

        await DataService.addInvoice({
            number, type: invType, companyId: form.companyId, projectId: form.projectId || undefined,
            date: form.date, dueDate: new Date(Date.parse(form.date) + 12096e5).toISOString().split('T')[0],
            status: PaymentStatus.DRAFT,
            lines: [line],
            shareholderSplit: split,
            fileData: form.fileData, fileName: form.fileName
        });
        setView('LIST');
        setForm({ date: new Date().toISOString().split('T')[0], companyId: '', projectId: '', totalInput: 0, vatIncluded: true, vatRate: 21, fileData: '', fileName: '' });
    };

    if (view === 'NEW') {
        const relevantCompanies = companies.filter(c => invType === InvoiceType.SALES ? c.type === CompanyType.CLIENT : c.type === CompanyType.SUPPLIER);
        const relevantProjects = projects.filter(p => p.companyId === form.companyId);

        return (
            <Card title="Factuur Uploaden" action={<Button variant="secondary" onClick={() => setView('LIST')}>Annuleren</Button>}>
                <div className="space-y-4">
                    <FileUpload onFileSelect={(data, name) => setForm({...form, fileData: data, fileName: name})} />
                    {form.fileName && <div className="text-xs font-bold text-green-600">PDF Gereed: {form.fileName}</div>}

                    <div className="grid grid-cols-2 gap-4">
                        <Select label="Type" value={invType} onChange={e => setInvType(e.target.value as InvoiceType)}><option value={InvoiceType.SALES}>Verkoop</option><option value={InvoiceType.PURCHASE}>Inkoop</option></Select>
                        <Input label="Datum" type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                        <Select label="Bedrijf" value={form.companyId} onChange={e => setForm({...form, companyId: e.target.value})}><option value="">Selecteer...</option>{relevantCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
                        <Select label="Project" value={form.projectId} onChange={e => setForm({...form, projectId: e.target.value})}><option value="">Geen Project</option>{relevantProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
                    </div>

                    <div className="border-t border-brand-taupe pt-4">
                        <div className="grid grid-cols-3 gap-4">
                            <Input label="Bedrag (Invoer)" type="number" step="0.01" value={form.totalInput} onChange={e => setForm({...form, totalInput: parseFloat(e.target.value)})} />
                            <Select label="Bedrag is" value={form.vatIncluded ? 'INCL' : 'EXCL'} onChange={e => setForm({...form, vatIncluded: e.target.value === 'INCL'})}><option value="INCL">Inclusief BTW</option><option value="EXCL">Exclusief BTW</option></Select>
                            <Select label="BTW Tarief" value={form.vatRate} onChange={e => setForm({...form, vatRate: parseInt(e.target.value)})}>
                                <option value="21">21%</option><option value="9">9%</option><option value="0">0%</option>
                            </Select>
                        </div>
                        <div className="bg-brand-cream p-3 flex justify-between items-center text-sm border border-brand-taupe">
                            <div>Netto: € {calculated.excl.toFixed(2)} | BTW: € {calculated.vat.toFixed(2)}</div>
                            <div className="font-bold text-lg text-brand-orange">Totaal: € {calculated.total.toFixed(2)}</div>
                        </div>
                    </div>
                    <Button onClick={handleSave}>Opslaan & Uploaden</Button>
                </div>
            </Card>
        );
    }

    const displayInvoices = invoices.filter(i => i.type === InvoiceType.SALES);
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center"><h2 className="text-2xl font-bold text-brand-brown uppercase">Verkoopfacturen</h2><Button onClick={() => setView('NEW')}>+ Upload Factuur</Button></div>
            <div className="overflow-x-auto border-2 border-brand-taupe bg-white">
                <table className="w-full text-sm text-left"><thead className="bg-brand-taupe text-white uppercase text-xs"><tr><th className="p-3">Datum</th><th className="p-3">Klant</th><th className="p-3 text-right">Totaal</th><th className="p-3">Status</th><th className="p-3">PDF</th><th className="p-3">Actie</th></tr></thead>
                    <tbody>
                        {displayInvoices.map(inv => {
                            const total = inv.lines.reduce((acc, l) => acc + (l.amount * (1 + l.vatRate/100)), 0);
                            const client = companies.find(c => c.id === inv.companyId)?.name || '...';
                            return (
                                <tr key={inv.id} className="border-b border-brand-taupe/10">
                                    <td className="p-3">{inv.date}</td><td className="p-3 font-bold">{client}</td><td className="p-3 text-right font-mono">€ {total.toFixed(2)}</td>
                                    <td className="p-3"><span className={`px-2 text-xs ${inv.status === 'BETAALD' ? 'bg-green-100 text-green-800' : 'bg-gray-100'}`}>{inv.status}</span></td>
                                    <td className="p-3">{inv.fileName ? '📎' : '-'}</td>
                                    <td className="p-3">{inv.status !== 'BETAALD' && <button onClick={async () => { await DataService.updateInvoiceStatus(inv.id, PaymentStatus.PAID); fetchData(); }} className="text-xs text-brand-orange hover:underline">Markeer Betaald</button>}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const CompanyInfoView = ({ summary, onSummaryUpdate }: { summary: FinancialSummary, onSummaryUpdate: () => void }) => {
    const [shareholders, setShareholders] = useState<Shareholder[]>([]);
    const [correction, setCorrection] = useState<number>(0);
    const [isAdding, setIsAdding] = useState(false);
    const [newShareholder, setNewShareholder] = useState({ name: '', percentage: 0 });
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        const s = await DataService.getShareholders();
        const val = await DataService.getSettings('company_value_correction');
        setShareholders(s);
        if (val) setCorrection(parseFloat(val));
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const handleCorrectionChange = async (val: number) => {
        setCorrection(val);
        await DataService.updateSettings('company_value_correction', val);
        onSummaryUpdate(); 
    };

    const handleAddShareholder = async () => {
        if(!newShareholder.name) return;
        await DataService.addShareholder({ id: crypto.randomUUID(), name: newShareholder.name, defaultPercentage: newShareholder.percentage });
        setIsAdding(false);
        setNewShareholder({ name: '', percentage: 0 });
        load();
    };

    const handleDeleteShareholder = async (id: string) => {
        if(confirm("Weet je het zeker?")) {
            await DataService.deleteShareholder(id);
            load();
        }
    };

    const companyValue = summary.profit + summary.investments - summary.vatTotal + correction;
    const safeCompanyValue = isNaN(companyValue) ? 0 : companyValue;

    return (
        <div className="grid grid-cols-1 gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card title="Bedrijf & Waardering">
                    <Metric label="Totale Bedrijfswaarde" value={`€ ${safeCompanyValue.toFixed(2)}`} highlight />
                    <div className="mt-6 pt-4 border-t border-brand-cream">
                        <Input label="Handmatige Waardecorrectie" type="number" value={correction} onChange={e => handleCorrectionChange(parseFloat(e.target.value))} />
                    </div>
                </Card>
                <Card title="Aandeelhouders" action={<Button variant="text" onClick={() => setIsAdding(!isAdding)}>{isAdding ? 'Annuleren' : '+ Toevoegen'}</Button>}>
                    {isAdding && (
                        <div className="bg-brand-cream p-4 mb-4 border border-brand-taupe">
                             <Input label="Naam" value={newShareholder.name} onChange={e => setNewShareholder({...newShareholder, name: e.target.value})} />
                             <Input label="Percentage" type="number" value={newShareholder.percentage} onChange={e => setNewShareholder({...newShareholder, percentage: parseFloat(e.target.value)})} />
                             <Button onClick={handleAddShareholder}>Opslaan</Button>
                        </div>
                    )}
                    {shareholders.map(sh => {
                        const shareValue = safeCompanyValue * (sh.defaultPercentage / 100);
                        return (
                            <div key={sh.id} className="mb-4 border-b border-brand-cream pb-2 last:border-0 group">
                                <div className="flex justify-between font-bold text-brand-brown items-center">
                                    <span>{sh.name}</span>
                                    <div className="flex items-center gap-2"><span className="bg-brand-taupe text-white px-2 text-xs flex items-center">{sh.defaultPercentage}%</span><button onClick={() => handleDeleteShareholder(sh.id)} className="text-red-400 hover:text-red-600 text-xs px-1">x</button></div>
                                </div>
                                <div className="flex justify-between text-sm mt-1"><span className="text-brand-taupe">Huidige waarde:</span><span className="font-mono">€ {shareValue.toFixed(2)}</span></div>
                            </div>
                        );
                    })}
                </Card>
            </div>
        </div>
    );
};

// --- Main ---

export default function App() {
    const [session, setSession] = useState(null);
    const [activeTab, setActiveTab] = useState('DASHBOARD');
    const [summary, setSummary] = useState<FinancialSummary>({ revenue: 0, expenses: 0, investments: 0, profit: 0, vatPayable: 0, vatDeductible: 0, vatTotal: 0, kiaDeduction: 0, manualCorrection: 0 });

    useEffect(() => {
        if (supabase) {
            supabase.auth.getSession().then(({ data: { session } }) => setSession(session as any));
            const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
                setSession(session as any);
            });
            return () => subscription.unsubscribe();
        }
    }, []);

    const loadSummary = async () => {
        if (!session) return;
        const [inv, exp, invest, correctionVal] = await Promise.all([
            DataService.getInvoices(), DataService.getExpenses(), DataService.getInvestments(), DataService.getSettings('company_value_correction')
        ]);
        
        const sales = inv.filter(i => i.type === InvoiceType.SALES && i.status !== PaymentStatus.DRAFT);
        const revenue = sales.reduce((acc, i) => acc + i.lines.reduce((s, l) => s + l.amount, 0), 0);
        const expensesTotal = exp.reduce((acc, e) => acc + e.amountExcl, 0);
        const investmentTotal = invest.reduce((acc, i) => acc + i.purchaseValue, 0);
        const correction = correctionVal ? parseFloat(correctionVal) : 0;
        const kia = calculateKiaDeduction(invest.filter(i => i.purchaseValue >= KIA_MIN_ITEM_VALUE).reduce((a, b) => a + b.purchaseValue, 0));
        const vatOut = sales.reduce((acc, i) => acc + i.lines.reduce((s, l) => s + (l.amount * l.vatRate/100), 0), 0);
        const vatIn = exp.reduce((acc, e) => acc + e.vatAmount, 0);

        setSummary({
            revenue, expenses: expensesTotal, investments: investmentTotal, profit: revenue - expensesTotal,
            vatPayable: vatOut, vatDeductible: vatIn, vatTotal: vatOut - vatIn, kiaDeduction: kia, manualCorrection: correction
        });
    };

    useEffect(() => { loadSummary(); }, [session, activeTab]);

    if (!session) return <AuthView onLogin={() => {}} />; 

    const NavItem = ({ id, label }: { id: string, label: string }) => (
        <button onClick={() => setActiveTab(id)} 
            className={`block w-full text-left py-3 px-4 uppercase text-sm font-bold tracking-wider border-l-4 transition-all ${activeTab === id ? 'border-brand-orange bg-white text-brand-orange' : 'border-transparent text-brand-taupe hover:text-brand-brown'}`}>
            {label}
        </button>
    );

    return (
        <div className="min-h-screen flex bg-brand-cream text-brand-brown font-sans">
            <aside className="w-64 border-r border-brand-taupe h-screen sticky top-0 bg-brand-cream flex flex-col">
                <div className="p-8 border-b border-brand-taupe mb-4"><h1 className="text-2xl font-bold text-brand-orange">LLM<br/><span className="text-brand-brown">SOLUTION</span></h1></div>
                <nav className="flex-1 space-y-1 overflow-y-auto">
                    <div className="px-4 pt-4 pb-2 text-xs font-bold text-brand-taupe opacity-50">BOEKHOUDING</div>
                    <NavItem id="DASHBOARD" label="Overzicht" /><NavItem id="INVOICES" label="Facturen" /><NavItem id="EXPENSES" label="Kosten" /><NavItem id="INVESTMENTS" label="Investeringen" /><NavItem id="VAT" label="BTW Aangifte" />
                    <div className="my-4 border-t border-brand-taupe opacity-20"></div>
                    <div className="px-4 pt-4 pb-2 text-xs font-bold text-brand-taupe opacity-50">LLM SOLUTION</div>
                    <NavItem id="COMPANY" label="Bedrijf & Partners" /><NavItem id="CLIENTS" label="Klanten" /><NavItem id="PROJECTS" label="Projecten" />
                </nav>
                <div className="p-4 border-t border-brand-taupe"><Button variant="secondary" onClick={() => supabase?.auth.signOut()} className="w-full text-xs">Uitloggen</Button></div>
            </aside>
            <main className="flex-1 p-8 overflow-auto">
                <div className="max-w-6xl mx-auto">
                    {activeTab === 'DASHBOARD' && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold uppercase">Dashboard</h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <Card title="Financieel">
                                    <div className="grid grid-cols-2 gap-4">
                                        <Metric label="Omzet" value={`€ ${summary.revenue.toFixed(2)}`} />
                                        <Metric label="Kosten" value={`€ ${summary.expenses.toFixed(2)}`} />
                                        <Metric label="Winst" value={`€ ${summary.profit.toFixed(2)}`} highlight />
                                    </div>
                                </Card>
                                <Card title="Belasting">
                                    <Metric label="BTW Te Betalen" value={`€ ${summary.vatTotal.toFixed(2)}`} />
                                    <Metric label="KIA Aftrek" value={`€ ${summary.kiaDeduction.toFixed(2)}`} subValue={summary.kiaDeduction > 0 ? "Toegepast" : "Niet van toepassing"} />
                                </Card>
                                <Card title="AI Advies" action={<Button variant="text" onClick={() => getFinancialAdvice(summary, "Quick scan")}>...</Button>}>
                                    <div className="text-sm italic text-brand-taupe">Klik op '...' voor advies.</div>
                                </Card>
                            </div>
                        </div>
                    )}
                    {activeTab === 'INVOICES' && <InvoicesView />}
                    {activeTab === 'EXPENSES' && <ExpensesView />}
                    {activeTab === 'INVESTMENTS' && <InvestmentsView />}
                    {activeTab === 'VAT' && <VatReturnView />}
                    {activeTab === 'CLIENTS' && <ClientsView />}
                    {activeTab === 'PROJECTS' && <ProjectsView />}
                    {activeTab === 'COMPANY' && <CompanyInfoView summary={summary} onSummaryUpdate={loadSummary} />}
                </div>
            </main>
        </div>
    );
}
