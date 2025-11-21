import React, { useState, useEffect } from 'react';
import { supabase } from './services/supabaseClient';
import { DataService } from './services/dataService';
import { getFinancialAdvice } from './services/geminiService';
import { 
    Company, CompanyType, Invoice, InvoiceType, PaymentStatus, Project, 
    Expense, Investment, Shareholder, VATRate, InvoiceLine, FinancialSummary 
} from './types';
import { 
    COLORS, EXPENSE_CATEGORIES, KIA_MIN_ITEM_VALUE, 
    KIA_THRESHOLD_MIN, KIA_BRACKET_1_MAX, KIA_BRACKET_2_MAX, KIA_BRACKET_3_MAX,
    KIA_PCT_LOW, KIA_FIXED_MID, KIA_REDUCTION_PCT
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
                
                <Button onClick={handleAuth} className="w-full mb-4">
                    {loading ? 'Laden...' : (isSignUp ? 'Registreren' : 'Inloggen')}
                </Button>
                
                <button onClick={() => setIsSignUp(!isSignUp)} className="text-xs text-brand-taupe hover:text-brand-orange w-full text-center">
                    {isSignUp ? 'Heb je al een account? Log in' : 'Nog geen account? Registreren'}
                </button>
            </div>
        </div>
    );
};

const CompaniesView = () => {
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
        setCompanies(data);
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
                <h2 className="text-2xl font-bold text-brand-brown uppercase">Relaties</h2>
                <Button onClick={() => setIsEditing(!isEditing)}>{isEditing ? 'Sluiten' : '+ Relatie'}</Button>
            </div>

            {isEditing && (
                <Card title="Nieuwe Relatie">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Bedrijfsnaam" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                        <Select label="Type" value={form.type} onChange={e => setForm({...form, type: e.target.value as CompanyType})}>
                            <option value={CompanyType.CLIENT}>Klant</option>
                            <option value={CompanyType.SUPPLIER}>Leverancier</option>
                            <option value={CompanyType.INTERNAL}>Intern</option>
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
                        <tr>
                            <th className="p-3">Naam</th>
                            <th className="p-3">Type</th>
                            <th className="p-3">Plaats</th>
                            <th className="p-3">KVK / BTW</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-cream">
                        {companies.map(c => (
                            <tr key={c.id} className="hover:bg-brand-cream/50">
                                <td className="p-3 font-bold">{c.name}</td>
                                <td className="p-3 uppercase text-xs">{c.type}</td>
                                <td className="p-3">{c.address?.city}</td>
                                <td className="p-3 font-mono text-xs">{c.kvk} <br/> {c.btw}</td>
                            </tr>
                        ))}
                        {companies.length === 0 && !loading && <tr><td colSpan={4} className="p-4 text-center text-brand-taupe">Geen relaties.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const ProjectsView = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [form, setForm] = useState<Partial<Project>>({ name: '', status: 'ACTIEF', startDate: new Date().toISOString().split('T')[0], budget: 0 });
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        const [p, c] = await Promise.all([DataService.getProjects(), DataService.getCompanies()]);
        setProjects(p);
        setCompanies(c);
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    const handleSave = async () => {
        if (!form.companyId) return alert("Selecteer een bedrijf");
        await DataService.addProject(form);
        setIsEditing(false);
        fetchData();
        setForm({ name: '', status: 'ACTIEF', startDate: new Date().toISOString().split('T')[0], budget: 0 });
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-brand-brown uppercase">Projecten</h2>
                <Button onClick={() => setIsEditing(!isEditing)}>{isEditing ? 'Sluiten' : '+ Project'}</Button>
            </div>

            {isEditing && (
                <Card title="Nieuw Project">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Projectnaam" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                        <Select label="Klant" value={form.companyId || ''} onChange={e => setForm({...form, companyId: e.target.value})}>
                            <option value="">Selecteer Klant...</option>
                            {companies.filter(c => c.type === CompanyType.CLIENT).map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </Select>
                        <Input label="Startdatum" type="date" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} />
                        <Select label="Status" value={form.status} onChange={e => setForm({...form, status: e.target.value as any})}>
                            <option value="ACTIEF">Actief</option>
                            <option value="VOLTOOID">Voltooid</option>
                            <option value="GEARCHIVEERD">Gearchiveerd</option>
                        </Select>
                        <Input label="Budget" type="number" value={form.budget} onChange={e => setForm({...form, budget: parseFloat(e.target.value)})} />
                    </div>
                    <Button onClick={handleSave} className="mt-4">Opslaan</Button>
                </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map(p => {
                    const clientName = companies.find(c => c.id === p.companyId)?.name || 'Onbekend';
                    return (
                        <Card key={p.id} title={p.name}>
                            <div className="text-sm space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-brand-taupe">Klant:</span>
                                    <span className="font-bold">{clientName}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-brand-taupe">Status:</span>
                                    <span className={`px-2 py-0.5 text-xs text-white ${p.status === 'ACTIEF' ? 'bg-green-600' : 'bg-brand-taupe'}`}>{p.status}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-brand-taupe">Start:</span>
                                    <span>{p.startDate}</span>
                                </div>
                            </div>
                        </Card>
                    );
                })}
                {projects.length === 0 && !loading && <p className="text-brand-taupe italic">Geen projecten.</p>}
            </div>
        </div>
    );
};

const InvoicesView = () => {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [view, setView] = useState<'LIST' | 'NEW'>('LIST');

    // New Invoice Form State
    const [invType, setInvType] = useState<InvoiceType>(InvoiceType.SALES);
    const [companyId, setCompanyId] = useState('');
    const [projectId, setProjectId] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [lines, setLines] = useState<InvoiceLine[]>([{ id: '1', description: '', amount: 0, vatRate: 21 }]);

    const fetchData = async () => {
        const [i, c, p] = await Promise.all([DataService.getInvoices(), DataService.getCompanies(), DataService.getProjects()]);
        setInvoices(i);
        setCompanies(c);
        setProjects(p);
    };

    useEffect(() => { fetchData(); }, [view]);

    const handleSave = async () => {
        if (!companyId) return alert("Selecteer een bedrijf");
        // Als het verkoop is, is een project verplicht volgens requirement 2?
        // "Projects koppelen aan bedrijven (verplichte afhankelijkheid)" -> Dit impliceert bedrijf<->project relatie.
        // We maken project keuze optioneel voor factuur, maar wel aangeraden.

        const number = `${invType === InvoiceType.SALES ? 'INV' : 'PUR'}-${date.substring(0,4)}-${date.substring(5,7)}-${Math.floor(Math.random() * 1000)}`;
        
        await DataService.addInvoice({
            number,
            type: invType,
            companyId,
            projectId: projectId || undefined,
            date,
            dueDate: new Date(Date.parse(date) + 12096e5).toISOString().split('T')[0], // +14 days
            status: PaymentStatus.DRAFT,
            lines,
            shareholderSplit: { 'sh_1': 50, 'sh_2': 50 }
        });
        setView('LIST');
    };

    const addLine = () => setLines([...lines, { id: crypto.randomUUID(), description: '', amount: 0, vatRate: 21 }]);

    if (view === 'NEW') {
        const relevantCompanies = companies.filter(c => invType === InvoiceType.SALES ? c.type === CompanyType.CLIENT : c.type === CompanyType.SUPPLIER);
        const relevantProjects = projects.filter(p => p.companyId === companyId);

        return (
            <Card title="Nieuwe Factuur" action={<Button variant="secondary" onClick={() => setView('LIST')}>Annuleren</Button>}>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Select label="Type" value={invType} onChange={e => setInvType(e.target.value as InvoiceType)}>
                            <option value={InvoiceType.SALES}>Verkoop</option>
                            <option value={InvoiceType.PURCHASE}>Inkoop</option>
                        </Select>
                        <Input label="Datum" type="date" value={date} onChange={e => setDate(e.target.value)} />
                        
                        <Select label="Bedrijf" value={companyId} onChange={e => setCompanyId(e.target.value)}>
                            <option value="">Selecteer...</option>
                            {relevantCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </Select>
                        
                        <Select label="Project (Optioneel)" value={projectId} onChange={e => setProjectId(e.target.value)}>
                            <option value="">Geen Project</option>
                            {relevantProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </Select>
                    </div>

                    <div>
                        <label className="block text-xs uppercase tracking-widest mb-2">Factuurregels</label>
                        {lines.map((line, idx) => (
                            <div key={line.id} className="grid grid-cols-12 gap-2 mb-2">
                                <div className="col-span-6">
                                    <input className="w-full p-2 border border-brand-taupe" placeholder="Omschrijving" value={line.description} 
                                        onChange={e => { const n = [...lines]; n[idx].description = e.target.value; setLines(n); }} />
                                </div>
                                <div className="col-span-3">
                                    <input type="number" className="w-full p-2 border border-brand-taupe" placeholder="Bedrag" value={line.amount} 
                                        onChange={e => { const n = [...lines]; n[idx].amount = parseFloat(e.target.value); setLines(n); }} />
                                </div>
                                <div className="col-span-3">
                                    <select className="w-full p-2 border border-brand-taupe" value={line.vatRate} 
                                        onChange={e => { const n = [...lines]; n[idx].vatRate = parseInt(e.target.value); setLines(n); }}>
                                        <option value={21}>21%</option>
                                        <option value={9}>9%</option>
                                        <option value={0}>0%</option>
                                    </select>
                                </div>
                            </div>
                        ))}
                        <Button variant="secondary" onClick={addLine} className="mt-2 text-xs">+ Regel</Button>
                    </div>
                    <Button onClick={handleSave}>Opslaan</Button>
                </div>
            </Card>
        );
    }

    // Filter for sales invoices primarily
    const displayInvoices = invoices.filter(i => i.type === InvoiceType.SALES);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-brand-brown uppercase">Verkoopfacturen</h2>
                <Button onClick={() => setView('NEW')}>+ Nieuwe Factuur</Button>
            </div>
            <div className="overflow-x-auto border-2 border-brand-taupe bg-white">
                <table className="w-full text-sm text-left">
                    <thead className="bg-brand-taupe text-white uppercase text-xs">
                        <tr>
                            <th className="p-3">Nr</th>
                            <th className="p-3">Datum</th>
                            <th className="p-3">Klant</th>
                            <th className="p-3 text-right">Totaal</th>
                            <th className="p-3">Status</th>
                            <th className="p-3">Actie</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayInvoices.map(inv => {
                            const total = inv.lines.reduce((acc, l) => acc + (l.amount * (1 + l.vatRate/100)), 0);
                            const client = companies.find(c => c.id === inv.companyId)?.name || '...';
                            return (
                                <tr key={inv.id} className="border-b border-brand-taupe/10">
                                    <td className="p-3 font-mono">{inv.number}</td>
                                    <td className="p-3">{inv.date}</td>
                                    <td className="p-3 font-bold">{client}</td>
                                    <td className="p-3 text-right font-mono">€ {total.toFixed(2)}</td>
                                    <td className="p-3"><span className={`px-2 text-xs ${inv.status === 'BETAALD' ? 'bg-green-100 text-green-800' : 'bg-gray-100'}`}>{inv.status}</span></td>
                                    <td className="p-3">
                                        {inv.status !== 'BETAALD' && (
                                            <button onClick={async () => { await DataService.updateInvoiceStatus(inv.id, PaymentStatus.PAID); fetchData(); }} className="text-xs text-brand-orange hover:underline">Markeer Betaald</button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const ExpensesView = () => {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [form, setForm] = useState<Partial<Expense>>({ description: '', amountExcl: 0, vatAmount: 0, category: EXPENSE_CATEGORIES[0] });

    const fetchData = async () => {
        setLoading(true);
        const data = await DataService.getExpenses();
        setExpenses(data);
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    const handleSave = async () => {
        await DataService.addExpense({ ...form, date: new Date().toISOString().split('T')[0] });
        setIsAdding(false);
        fetchData();
        setForm({ description: '', amountExcl: 0, vatAmount: 0, category: EXPENSE_CATEGORIES[0] });
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-brand-brown uppercase">Kosten</h2>
                <Button onClick={() => setIsAdding(!isAdding)}>{isAdding ? 'Sluiten' : '+ Kosten'}</Button>
            </div>

            {isAdding && (
                <Card title="Nieuwe Kostenpost">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <Input label="Omschrijving" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
                        <Select label="Categorie" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                            {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </Select>
                        <Input label="Bedrag (Excl BTW)" type="number" value={form.amountExcl} onChange={e => setForm({...form, amountExcl: parseFloat(e.target.value)})} />
                        <Input label="BTW Bedrag" type="number" value={form.vatAmount} onChange={e => setForm({...form, vatAmount: parseFloat(e.target.value)})} />
                    </div>
                    <Button onClick={handleSave}>Opslaan</Button>
                </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {expenses.map(e => (
                    <div key={e.id} className="bg-white border border-brand-taupe p-4 flex justify-between">
                        <div>
                            <div className="font-bold">{e.description}</div>
                            <div className="text-xs text-brand-taupe uppercase">{e.category}</div>
                        </div>
                        <div className="text-right">
                            <div className="font-mono font-bold">€ {e.amountExcl.toFixed(2)}</div>
                            <div className="text-xs text-brand-taupe">BTW: € {e.vatAmount.toFixed(2)}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const DashboardView = ({ summary }: { summary: FinancialSummary }) => {
    const [advice, setAdvice] = useState('');
    const [loading, setLoading] = useState(false);

    const getAiHelp = async () => {
        setLoading(true);
        const txt = await getFinancialAdvice(summary, "Geef een analyse van de huidige financiële stand en KIA status.");
        setAdvice(txt);
        setLoading(false);
    };

    return (
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
            <Card title="AI Advies" action={<Button variant="text" onClick={getAiHelp}>{loading ? '...' : 'Analyseren'}</Button>}>
                <div className="text-sm whitespace-pre-wrap">{advice || "Vraag advies aan..."}</div>
            </Card>
        </div>
    );
};

const CompanyInfoView = ({ summary }: { summary: FinancialSummary }) => {
    const [shareholders, setShareholders] = useState<Shareholder[]>([]);
    
    useEffect(() => {
        const load = async () => {
            const s = await DataService.getShareholders();
            setShareholders(s);
        };
        load();
    }, []);

    const companyValue = summary.profit + summary.investments - summary.vatTotal; // Simplified valuation

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card title="Bedrijfswaarde">
                <Metric label="Totale Waarde" value={`€ ${companyValue.toFixed(2)}`} highlight />
                <div className="text-xs text-brand-taupe mt-2">
                    Gebaseerd op winst + boekwaarde investeringen - openstaande belasting.
                </div>
            </Card>
            <Card title="Aandeelhouders">
                {shareholders.map(sh => {
                    const shareValue = companyValue * (sh.defaultPercentage / 100);
                    return (
                        <div key={sh.id} className="mb-4 border-b border-brand-cream pb-2 last:border-0">
                            <div className="flex justify-between font-bold text-brand-brown">
                                <span>{sh.name}</span>
                                <span>{sh.defaultPercentage}%</span>
                            </div>
                            <div className="flex justify-between text-sm mt-1">
                                <span className="text-brand-taupe">Huidig aandeel:</span>
                                <span className="font-mono">€ {shareValue.toFixed(2)}</span>
                            </div>
                        </div>
                    );
                })}
            </Card>
        </div>
    );
};

const InvestmentsView = () => {
    // Simple Investment view logic (abbreviated for space, assumed similar to previous but async)
    const [investments, setInvestments] = useState<Investment[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [form, setForm] = useState<Partial<Investment>>({ description: '', purchaseValue: 0, lifespanYears: 5, category: 'HARDWARE' });

    const fetchData = async () => {
        setInvestments(await DataService.getInvestments());
    };
    useEffect(() => { fetchData(); }, []);

    const handleSave = async () => {
        await DataService.addInvestment({ ...form, date: new Date().toISOString().split('T')[0] });
        setIsAdding(false);
        fetchData();
    };
    
    // KIA Logic
    const qualifying = investments.filter(i => i.purchaseValue >= KIA_MIN_ITEM_VALUE);
    const totalInv = qualifying.reduce((acc, i) => acc + i.purchaseValue, 0);
    const kia = calculateKiaDeduction(totalInv);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                 <h2 className="text-2xl font-bold text-brand-brown uppercase">Investeringen</h2>
                 <Button onClick={() => setIsAdding(!isAdding)}>{isAdding ? 'Sluiten' : '+ Investering'}</Button>
            </div>
            <div className="bg-brand-brown text-brand-cream p-4 grid grid-cols-3 gap-4">
                <div>
                    <span className="text-xs uppercase text-brand-taupe">Totaal KIA Geschikt</span>
                    <div className="text-xl font-mono">€ {totalInv.toFixed(2)}</div>
                </div>
                <div>
                    <span className="text-xs uppercase text-brand-taupe">KIA Aftrek</span>
                    <div className="text-xl font-mono font-bold text-brand-orange">€ {kia.toFixed(2)}</div>
                </div>
            </div>

            {isAdding && (
                <Card title="Nieuwe Investering">
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Omschrijving" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
                        <Input label="Waarde" type="number" value={form.purchaseValue} onChange={e => setForm({...form, purchaseValue: parseFloat(e.target.value)})} />
                    </div>
                    <Button onClick={handleSave} className="mt-4">Opslaan</Button>
                </Card>
            )}

            <div className="bg-white border-2 border-brand-taupe">
                {investments.map(i => (
                    <div key={i.id} className="flex justify-between p-3 border-b border-brand-cream">
                        <span>{i.description}</span>
                        <span className="font-mono">€ {i.purchaseValue.toFixed(2)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- Main ---

export default function App() {
    const [session, setSession] = useState(null);
    const [activeTab, setActiveTab] = useState('DASHBOARD');
    const [summary, setSummary] = useState<FinancialSummary>({ revenue: 0, expenses: 0, investments: 0, profit: 0, vatPayable: 0, vatDeductible: 0, vatTotal: 0, kiaDeduction: 0 });

    useEffect(() => {
        if (supabase) {
            supabase.auth.getSession().then(({ data: { session } }) => setSession(session as any));
            const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
                setSession(session as any);
            });
            return () => subscription.unsubscribe();
        }
    }, []);

    // Calculate summary across all data
    useEffect(() => {
        if (!session) return;
        const loadSummary = async () => {
            const [inv, exp, invest] = await Promise.all([DataService.getInvoices(), DataService.getExpenses(), DataService.getInvestments()]);
            
            const sales = inv.filter(i => i.type === InvoiceType.SALES && i.status !== PaymentStatus.DRAFT);
            const revenue = sales.reduce((acc, i) => acc + i.lines.reduce((s, l) => s + l.amount, 0), 0);
            const expensesTotal = exp.reduce((acc, e) => acc + e.amountExcl, 0);
            const investmentTotal = invest.reduce((acc, i) => acc + i.purchaseValue, 0);
            
            // Simple KIA calc
            const kia = calculateKiaDeduction(invest.filter(i => i.purchaseValue >= KIA_MIN_ITEM_VALUE).reduce((a, b) => a + b.purchaseValue, 0));

            const vatOut = sales.reduce((acc, i) => acc + i.lines.reduce((s, l) => s + (l.amount * l.vatRate/100), 0), 0);
            const vatIn = exp.reduce((acc, e) => acc + e.vatAmount, 0);

            setSummary({
                revenue, expenses: expensesTotal, investments: investmentTotal,
                profit: revenue - expensesTotal,
                vatPayable: vatOut, vatDeductible: vatIn, vatTotal: vatOut - vatIn,
                kiaDeduction: kia
            });
        };
        loadSummary();
    }, [session, activeTab]);

    if (!session) return <AuthView onLogin={() => {}} />; // onLogin handled by auth state change listener

    const NavItem = ({ id, label }: { id: string, label: string }) => (
        <button onClick={() => setActiveTab(id)} 
            className={`block w-full text-left py-3 px-4 uppercase text-sm font-bold tracking-wider border-l-4 transition-all ${activeTab === id ? 'border-brand-orange bg-white text-brand-orange' : 'border-transparent text-brand-taupe hover:text-brand-brown'}`}>
            {label}
        </button>
    );

    return (
        <div className="min-h-screen flex bg-brand-cream text-brand-brown font-sans">
            <aside className="w-64 border-r border-brand-taupe h-screen sticky top-0 bg-brand-cream flex flex-col">
                <div className="p-8 border-b border-brand-taupe mb-4">
                    <h1 className="text-2xl font-bold text-brand-orange">LLM<br/><span className="text-brand-brown">SOLUTION</span></h1>
                </div>
                <nav className="flex-1 space-y-1">
                    <NavItem id="DASHBOARD" label="Overzicht" />
                    <NavItem id="INVOICES" label="Facturen" />
                    <NavItem id="EXPENSES" label="Kosten" />
                    <NavItem id="INVESTMENTS" label="Investeringen" />
                    <div className="my-4 border-t border-brand-taupe opacity-20"></div>
                    <NavItem id="COMPANIES" label="Relaties" />
                    <NavItem id="PROJECTS" label="Projecten" />
                    <NavItem id="COMPANY" label="Bedrijf" />
                </nav>
                <div className="p-4">
                    <Button variant="secondary" onClick={() => supabase?.auth.signOut()} className="w-full">Uitloggen</Button>
                </div>
            </aside>
            <main className="flex-1 p-8 overflow-auto">
                <div className="max-w-6xl mx-auto">
                    {activeTab === 'DASHBOARD' && <DashboardView summary={summary} />}
                    {activeTab === 'INVOICES' && <InvoicesView />}
                    {activeTab === 'EXPENSES' && <ExpensesView />}
                    {activeTab === 'INVESTMENTS' && <InvestmentsView />}
                    {activeTab === 'COMPANIES' && <CompaniesView />}
                    {activeTab === 'PROJECTS' && <ProjectsView />}
                    {activeTab === 'COMPANY' && <CompanyInfoView summary={summary} />}
                </div>
            </main>
        </div>
    );
}
