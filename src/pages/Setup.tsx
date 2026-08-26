export default function Setup() {
  return (
    <div className="center-wrap">
      <div className="card setup-card">
        <div className="logo-big">IELTS<span>Bridge</span> CRM</div>
        <h2>Sozlash kerak</h2>
        <p>Supabase loyihasi hali ulanmagan. Quyidagi qadamlarni bajaring:</p>
        <ol>
          <li><b>supabase.com</b> da bepul akkaunt oching va <b>New project</b> yarating (region: Singapore yaqinroq).</li>
          <li>Loyihada <b>SQL Editor</b> ni oching va <code>supabase/migrations/</code> papkasidagi ikkala faylni tartib bilan ishga tushiring:<br />
            <code>20260825100000_schema.sql</code>, keyin <code>20260825100001_content_seed.sql</code>.</li>
          <li><b>Authentication → Users → Add user</b> orqali o'zingizga admin foydalanuvchi yarating (email + parol, "Auto confirm" belgilang).</li>
          <li><b>Settings → API</b> dan <b>Project URL</b> va <b>anon public key</b> ni oling.</li>
          <li>Loyiha papkasida <code>.env.example</code> ni <code>.env</code> nomi bilan nusxalab, shu ikkala qiymatni yozing.</li>
          <li>Dastur serverini qayta ishga tushiring.</li>
        </ol>
        <p className="muted">Batafsil yo'riqnoma: <code>SOZLASH.md</code></p>
      </div>
    </div>
  );
}
