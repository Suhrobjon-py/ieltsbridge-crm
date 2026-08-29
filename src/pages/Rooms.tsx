import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { KUNLAR } from '../lib/format';
import Modal from '../components/Modal';
import Confirm from '../components/Confirm';
import { useRole } from '../lib/role';

const BOSH_SOAT = 8;   // 08:00
const OXIR_SOAT = 21;  // 21:00
const ORALIQ = OXIR_SOAT - BOSH_SOAT; // 13 soat
const DARS_SOAT = 1.5; // 90 daqiqa

function soat(t: string): number {
  const [h, m] = String(t).split(':').map(Number);
  return h + (m || 0) / 60;
}

function vaqtFmt(t: string): string {
  return String(t).slice(0, 5);
}

function tugashVaqti(s: number): string {
  const e = s + DARS_SOAT;
  const h = Math.floor(e);
  const m = Math.round((e - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export default function Rooms() {
  const nav = useNavigate();
  const { superadmin } = useRole();
  const [rooms, setRooms] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [modal, setModal] = useState<null | { id?: string }>(null);
  const [nomi, setNomi] = useState('');
  const [sigim, setSigim] = useState(12);
  const [xato, setXato] = useState('');
  const [ochirRoom, setOchirRoom] = useState<any>(null);

  async function load() {
    const [r, g] = await Promise.all([
      supabase.from('rooms').select('*').order('id'),
      supabase.from('groups')
        .select('id, room_id, days_pattern, start_time, level_code, status, capacity, teachers!groups_teacher_id_fkey(full_name)')
        .in('status', ['rejada', 'faol', 'imtihon']),
    ]);
    setRooms(r.data ?? []);
    setGroups(g.data ?? []);
  }
  useEffect(() => { load(); }, []);

  function yangiOch() {
    setNomi('');
    setSigim(12);
    setXato('');
    setModal({});
  }

  function tahrirOch(r: any) {
    setNomi(r.name);
    setSigim(r.capacity);
    setXato('');
    setModal({ id: r.id });
  }

  async function saqla(e: React.FormEvent) {
    e.preventDefault();
    setXato('');
    if (!nomi.trim()) return setXato('Xona nomini kiriting');
    if (modal?.id) {
      const { error } = await supabase.from('rooms').update({ name: nomi.trim(), capacity: sigim }).eq('id', modal.id);
      if (error) return setXato(error.message);
    } else {
      const maxN = rooms.reduce((m, r) => {
        const n = Number(String(r.id).replace('XONA-', ''));
        return Number.isFinite(n) ? Math.max(m, n) : m;
      }, 0);
      const { error } = await supabase.from('rooms').insert({ id: `XONA-${maxN + 1}`, name: nomi.trim(), capacity: sigim });
      if (error) return setXato(error.message);
    }
    setModal(null);
    load();
  }

  async function ochir() {
    const r = ochirRoom;
    setOchirRoom(null);
    const { error } = await supabase.from('rooms').delete().eq('id', r.id);
    if (error) {
      if (error.code === '23503') return alert("O'chirib bo'lmadi: bu xonaga guruhlar biriktirilgan. Avval guruhlarni boshqa xonaga o'tkazing.");
      if (error.code === '42501') return alert("O'chirish faqat Superadmin uchun.");
      return alert('Xato: ' + error.message);
    }
    load();
  }

  // xona + kunlar bo'yicha bloklar, ustma-ust tushganlarini belgilash
  function lane(roomId: string, pattern: string) {
    const blocks = groups
      .filter((g) => g.room_id === roomId && g.days_pattern === pattern)
      .map((g) => ({ ...g, s: soat(g.start_time) }))
      .sort((a, b) => a.s - b.s);
    let prevEnd = -1;
    for (const b of blocks) {
      (b as any).overlap = b.s < prevEnd;
      prevEnd = Math.max(prevEnd, b.s + DARS_SOAT);
    }
    // oldingi blok bilan ustma-ust bo'lsa ikkalasini ham belgilash
    for (let i = 1; i < blocks.length; i++) {
      if ((blocks[i] as any).overlap) (blocks[i - 1] as any).overlap = true;
    }
    return blocks;
  }

  const soatlar = Array.from({ length: ORALIQ }, (_, i) => BOSH_SOAT + i);
  const xonasiz = groups.filter((g) => !g.room_id);

  return (
    <div>
      <div className="page-head">
        <h1>Xonalar</h1>
        <button className="btn btn-plus" title="Yangi xona qo'shish" onClick={yangiOch}>+</button>
      </div>

      <div className="card">
        <div className="row-between">
          <h2>Bandlik xaritasi</h2>
          <div className="legend">
            <span className="legend-chip"><i style={{ background: 'var(--navy)' }} />General</span>
            <span className="legend-chip"><i style={{ background: '#b8860b' }} />IELTS</span>
            <span className="legend-chip"><i style={{ background: '#dc2626' }} />To'qnashuv!</span>
          </div>
        </div>
        <p className="muted small">Har xona uchun ikki qator: Du·Chor·Ju va Se·Pay·Shan. Blok = 90 daqiqalik dars (bosish — guruh sahifasi). Bo'sh joy = xona bo'sh.</p>

        {rooms.length === 0 ? (
          <p className="muted">Hali xona yo'q. Yuqoridagi "+" bilan qo'shing.</p>
        ) : (
          <div className="xmap">
            <div className="xmap-row xmap-head">
              <div className="xmap-side" />
              <div className="xmap-hours">
                {soatlar.map((h) => <span key={h}>{String(h).padStart(2, '0')}</span>)}
              </div>
            </div>
            {rooms.map((r) => (
              <div key={r.id} className="xmap-room">
                <div className="xmap-roomhead">
                  <b>{r.name}</b> <span className="muted small">({r.id} · sig'im {r.capacity})</span>
                  <span className="row-gap" style={{ marginLeft: 'auto' }}>
                    <button className="btn-ghost small" onClick={() => tahrirOch(r)}>Tahrirlash</button>
                    {superadmin && <button className="btn-ghost small red" onClick={() => setOchirRoom(r)}>O'chirish</button>}
                  </span>
                </div>
                {(['DCJ', 'SPS'] as const).map((p) => (
                  <div key={p} className="xmap-row">
                    <div className="xmap-side">{KUNLAR[p]}</div>
                    <div className="xlane">
                      {lane(r.id, p).map((g: any) => (
                        <div
                          key={g.id}
                          className={'xblok' + (g.level_code === 'IEL' ? ' ielts' : '') + (g.overlap ? ' overlap' : '')}
                          style={{ left: `${((g.s - BOSH_SOAT) / ORALIQ) * 100}%`, width: `${(DARS_SOAT / ORALIQ) * 100}%` }}
                          title={`${g.id} · ${vaqtFmt(g.start_time)}-${tugashVaqti(g.s)} · ${g.teachers?.full_name ?? ''}${g.overlap ? " · DIQQAT: vaqt to'qnashuvi!" : ''}`}
                          onClick={() => nav(`/guruhlar/${g.id}`)}
                        >
                          {vaqtFmt(g.start_time)} {g.id.replace('GRP-', '')}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {xonasiz.length > 0 && (
        <div className="card">
          <h2>⚠ Xonasiz guruhlar</h2>
          <p className="muted small">Bu guruhlarga xona biriktirilmagan — guruh sahifasidagi Sozlamalardan xona tanlang.</p>
          <div className="row-gap">
            {xonasiz.map((g) => (
              <button key={g.id} className="btn-sm" onClick={() => nav(`/guruhlar/${g.id}`)}>
                {g.id} · {KUNLAR[g.days_pattern]} {vaqtFmt(g.start_time)}
              </button>
            ))}
          </div>
        </div>
      )}

      {modal && (
        <Modal title={modal.id ? `Xonani tahrirlash — ${modal.id}` : 'Yangi xona'} onClose={() => setModal(null)}>
          <form onSubmit={saqla} className="form-grid">
            <label>Xona nomi
              <input value={nomi} onChange={(e) => setNomi(e.target.value)} placeholder="Masalan: 1-xona (katta)" required autoFocus />
            </label>
            <label>Sig'imi (o'quvchi)
              <input type="number" value={sigim} onChange={(e) => setSigim(Number(e.target.value))} min="1" max="50" required />
            </label>
            {xato && <div className="err span2">{xato}</div>}
            <button className="btn span2">Saqlash</button>
          </form>
        </Modal>
      )}

      {ochirRoom && (
        <Confirm
          text={`${ochirRoom.name} (${ochirRoom.id}) xonasini o'chirishga ishonchingiz komilmi?`}
          onHa={ochir}
          onYoq={() => setOchirRoom(null)}
        />
      )}
    </div>
  );
}
