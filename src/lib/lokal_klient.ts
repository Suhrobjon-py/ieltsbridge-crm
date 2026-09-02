// LOKAL REJIM KLIENTI — supabase-js interfeysini lokal serverga yo'naltiradi.
// Ilova kodi o'zgarmaydi: from().select().eq()... xuddi shunday ishlayveradi.

type Filtr = { turi: string; ustun?: string; qiymat?: any };

function sessiyaniTozala() {
  localStorage.removeItem('lokal_token');
  localStorage.removeItem('lokal_email');
  tinglovchilar.forEach((cb) => cb('SIGNED_OUT', null));
}

async function api(yol: string, body?: any, method = 'POST'): Promise<any> {
  const yuborilganToken = localStorage.getItem('lokal_token') ?? '';
  const r = await fetch(yol, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-token': yuborilganToken },
    body: body ? JSON.stringify(body) : undefined,
  });
  // server qayta ishga tushgan bo'lsa eski token yaroqsiz — login sahifasiga qaytamiz.
  // Faqat AYNAN shu (eski) token hali ham joriy bo'lsa tozalaymiz — yangi kirishni buzmaslik uchun.
  if (r.status === 401 && yol !== '/api/kirish') {
    if (localStorage.getItem('lokal_token') === yuborilganToken) sessiyaniTozala();
    return { error: { message: 'Sessiya tugadi — qayta kiring', code: '401' } };
  }
  return r.json();
}

class Sorov {
  jadval: string;
  amal = 'select';
  ustunlar?: string;
  filtrlar: Filtr[] = [];
  tartib: { ustun: string; osish: boolean }[] = [];
  limitN?: number;
  singleTuri?: 'single' | 'maybe';
  countTuri?: string;
  headMi = false;
  qiymatlar?: any;
  onConflictS?: string;
  returning?: string | null;

  constructor(jadval: string) { this.jadval = jadval; }

  select(ustunlar?: string, opts?: { count?: string; head?: boolean }) {
    if (this.amal === 'select') this.ustunlar = ustunlar ?? '*';
    else this.returning = ustunlar ?? '*';
    if (opts?.count) this.countTuri = opts.count;
    if (opts?.head) this.headMi = true;
    return this;
  }
  insert(q: any) { this.amal = 'insert'; this.qiymatlar = q; return this; }
  upsert(q: any, opts?: { onConflict?: string }) { this.amal = 'upsert'; this.qiymatlar = q; this.onConflictS = opts?.onConflict; return this; }
  update(q: any) { this.amal = 'update'; this.qiymatlar = q; return this; }
  delete() { this.amal = 'delete'; return this; }

  eq(u: string, q: any) { this.filtrlar.push({ turi: 'eq', ustun: u, qiymat: q }); return this; }
  neq(u: string, q: any) { this.filtrlar.push({ turi: 'neq', ustun: u, qiymat: q }); return this; }
  gt(u: string, q: any) { this.filtrlar.push({ turi: 'gt', ustun: u, qiymat: q }); return this; }
  gte(u: string, q: any) { this.filtrlar.push({ turi: 'gte', ustun: u, qiymat: q }); return this; }
  lt(u: string, q: any) { this.filtrlar.push({ turi: 'lt', ustun: u, qiymat: q }); return this; }
  lte(u: string, q: any) { this.filtrlar.push({ turi: 'lte', ustun: u, qiymat: q }); return this; }
  ilike(u: string, q: any) { this.filtrlar.push({ turi: 'ilike', ustun: u, qiymat: q }); return this; }
  is(u: string, q: any) { this.filtrlar.push({ turi: 'is', ustun: u, qiymat: q }); return this; }
  in(u: string, q: any[]) { this.filtrlar.push({ turi: 'in', ustun: u, qiymat: q }); return this; }
  or(s: string) { this.filtrlar.push({ turi: 'or', qiymat: s }); return this; }
  order(u: string, opts?: { ascending?: boolean }) { this.tartib.push({ ustun: u, osish: opts?.ascending !== false }); return this; }
  limit(n: number) { this.limitN = n; return this; }
  single() { this.singleTuri = 'single'; if (this.amal !== 'select' && !this.returning) this.returning = '*'; return this; }
  maybeSingle() { this.singleTuri = 'maybe'; return this; }

  async bajar(): Promise<{ data: any; error: any; count?: number }> {
    const r = await api('/api/sorov', {
      jadval: this.jadval, amal: this.amal, ustunlar: this.ustunlar,
      filtrlar: this.filtrlar, tartib: this.tartib, limit: this.limitN,
      single: this.singleTuri, count: this.countTuri, head: this.headMi,
      qiymatlar: this.qiymatlar, onConflict: this.onConflictS, returning: this.returning,
    });
    return { data: r.data ?? null, error: r.error ?? null, count: r.count };
  }
  then(res: any, rej?: any) { return this.bajar().then(res, rej); }
}

type Tinglovchi = (hodisa: string, sessiya: any) => void;
const tinglovchilar = new Set<Tinglovchi>();

function sessiyaOl() {
  const email = localStorage.getItem('lokal_email');
  const token = localStorage.getItem('lokal_token');
  return email && token ? { user: { email } } : null;
}

export const lokalKlient: any = {
  from(jadval: string) { return new Sorov(jadval); },

  async rpc(nom: string, params?: any) {
    const r = await api('/api/rpc', { nom, params });
    return { data: r.data ?? null, error: r.error ?? null };
  },

  auth: {
    async getSession() {
      const s = sessiyaOl();
      if (!s) return { data: { session: null } };
      // token hali serverda amal qiladimi? (server qayta yoqilgan bo'lishi mumkin)
      const r = await api('/api/men');
      if (r.error) return { data: { session: null } };
      return { data: { session: s } };
    },
    onAuthStateChange(cb: Tinglovchi) {
      tinglovchilar.add(cb);
      return { data: { subscription: { unsubscribe: () => tinglovchilar.delete(cb) } } };
    },
    async signInWithPassword({ email, password }: { email: string; password: string }) {
      const r = await api('/api/kirish', { email, parol: password });
      if (r.error) return { error: { message: r.error } };
      localStorage.setItem('lokal_token', r.token);
      localStorage.setItem('lokal_email', r.email);
      const s = sessiyaOl();
      tinglovchilar.forEach((cb) => cb('SIGNED_IN', s));
      return { data: { session: s }, error: null };
    },
    async signOut() {
      await api('/api/chiqish', {});
      localStorage.removeItem('lokal_token');
      localStorage.removeItem('lokal_email');
      tinglovchilar.forEach((cb) => cb('SIGNED_OUT', null));
      return { error: null };
    },
    async signUp({ email, password }: { email: string; password: string }) {
      const r = await api('/api/signup', { email, parol: password });
      return { data: {}, error: r.error ? { message: r.error.message } : null };
    },
  },
};
