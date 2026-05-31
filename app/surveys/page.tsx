'use client';

import { useEffect, useState } from 'react';
import { useCurrentMember }    from '@/providers/auth-provider';
import { MobileAppShell }      from '@/shared/components/mobile-app-shell';
import { ProtectedRoute }      from '@/shared/components/protected-route';
import { LoadingState }        from '@/shared/components/loading-state';

type Choice   = { value: string; label: string };
type Question = { id: string; survey_id: string; question_text: string; question_type: 'text'|'number'|'yes_no'|'choice'|'rating'; choices: Choice[]|null; order_no: number };
type Survey   = { id: string; title: string; description: string|null };
type Answer   = { question_id: string; answer_text?: string|null; answer_number?: number|null; answer_yes_no?: boolean|null; answer_choice?: string|null };

function SurveyForm({ survey, questions, onDone }: { survey: Survey; questions: Question[]; onDone: () => void }) {
  const member = useCurrentMember();
  const [answers, setAnswers] = useState<Record<string,Answer>>({});
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string|null>(null);

  function set(qid: string, patch: Partial<Answer>) {
    setAnswers(p => ({ ...p, [qid]: { ...(p[qid]??{question_id:qid}), ...patch } }));
  }

  async function submit() {
    setSaving(true); setError(null);
    const res = await fetch('/api/member/surveys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ survey_id: survey.id, member_id: member?.member_id, answers: questions.map(q => answers[q.id]??{question_id:q.id}) }),
    });
    const j = await res.json() as { ok?:boolean; error?:string };
    setSaving(false);
    if (!res.ok) { setError(j.error ?? 'ส่งไม่สำเร็จ'); return; }
    onDone();
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {survey.description && <p style={{ margin:0, fontSize:13, color:'#6b7280', lineHeight:1.6 }}>{survey.description}</p>}
      {error && <div style={{ padding:'10px 14px', borderRadius:10, background:'#ffebee', color:'#c62828', fontSize:13 }}>{error}</div>}
      {[...questions].sort((a,b)=>a.order_no-b.order_no).map((q,i) => (
        <div key={q.id} style={{ background:'#fff', borderRadius:14, border:'1px solid #e8ede8', padding:'14px 16px' }}>
          <p style={{ margin:'0 0 10px', fontSize:13, fontWeight:700 }}>{i+1}. {q.question_text}</p>
          {q.question_type==='text' && <textarea rows={2} className="reg-input" style={{ resize:'none', fontFamily:'inherit' }} placeholder="พิมพ์คำตอบ…" value={answers[q.id]?.answer_text??''} onChange={e=>set(q.id,{question_id:q.id,answer_text:e.target.value})} />}
          {q.question_type==='number' && <input type="number" inputMode="decimal" className="reg-input" placeholder="กรอกตัวเลข" value={answers[q.id]?.answer_number??''} onChange={e=>set(q.id,{question_id:q.id,answer_number:Number(e.target.value)||null})} />}
          {q.question_type==='yes_no' && (
            <div style={{ display:'flex', gap:10 }}>
              {([{v:true,l:'✅ ใช่'},{v:false,l:'❌ ไม่ใช่'}] as {v:boolean;l:string}[]).map(({v,l}) => (
                <button key={String(v)} onClick={()=>set(q.id,{question_id:q.id,answer_yes_no:v})} style={{ flex:1, padding:10, borderRadius:12, border:`1.5px solid ${answers[q.id]?.answer_yes_no===v?'#2e7d32':'#e5e7eb'}`, background:answers[q.id]?.answer_yes_no===v?'#e8f5e9':'#fff', cursor:'pointer', fontSize:14, fontWeight:700 }}>{l}</button>
              ))}
            </div>
          )}
          {q.question_type==='choice' && (q.choices??[]).map(c => (
            <button key={c.value} onClick={()=>set(q.id,{question_id:q.id,answer_choice:c.value})} style={{ display:'block', width:'100%', textAlign:'left', marginBottom:6, padding:'10px 14px', borderRadius:10, border:`1.5px solid ${answers[q.id]?.answer_choice===c.value?'#2e7d32':'#e5e7eb'}`, background:answers[q.id]?.answer_choice===c.value?'#e8f5e9':'#fff', cursor:'pointer', fontSize:13 }}>
              {answers[q.id]?.answer_choice===c.value?'🔵':'⚪'} {c.label}
            </button>
          ))}
          {q.question_type==='rating' && (
            <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={()=>set(q.id,{question_id:q.id,answer_number:n})} style={{ fontSize:32, background:'none', border:'none', cursor:'pointer', color:(answers[q.id]?.answer_number??0)>=n?'#f59e0b':'#e5e7eb' }}>★</button>
              ))}
            </div>
          )}
        </div>
      ))}
      <button onClick={submit} disabled={saving} style={{ width:'100%', padding:14, borderRadius:14, border:'none', background:saving?'#e5e7eb':'#2e7d32', color:saving?'#9ca3af':'#fff', fontSize:15, fontWeight:800, cursor:'pointer' }}>
        {saving?'กำลังส่ง…':'📤 ส่งแบบสอบถาม'}
      </button>
    </div>
  );
}

function SurveysContent() {
  const [surveys,   setSurveys]   = useState<Survey[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selected,  setSelected]  = useState<Survey|null>(null);
  const [done,      setDone]      = useState<Set<string>>(new Set());
  const [loading,   setLoading]   = useState(true);
  const [notice,    setNotice]    = useState<string|null>(null);

  useEffect(() => {
    void fetch('/api/member/surveys').then(r=>r.json()).then((j:{surveys?:Survey[];questions?:Question[]}) => {
      setSurveys(j.surveys??[]); setQuestions(j.questions??[]); setLoading(false);
    });
  }, []);

  if (loading) return <LoadingState label="กำลังโหลด…" />;

  if (selected) {
    return (
      <MobileAppShell title={selected.title} subtitle="กรุณาตอบให้ครบ">
        <div style={{ paddingBottom:40 }}>
          <button onClick={()=>setSelected(null)} style={{ background:'none', border:'none', color:'var(--primary)', fontWeight:700, fontSize:14, cursor:'pointer', padding:'0 0 12px' }}>← กลับ</button>
          {notice && <div style={{ padding:'10px 14px', borderRadius:10, background:'#e8f5e9', color:'#1b5e20', fontSize:13, fontWeight:600, marginBottom:12 }}>{notice}</div>}
          <SurveyForm survey={selected} questions={questions.filter(q=>q.survey_id===selected.id)} onDone={()=>{ setDone(p=>new Set([...p,selected.id])); setNotice('✅ ขอบคุณสำหรับข้อมูลค่ะ!'); setSelected(null); }} />
        </div>
      </MobileAppShell>
    );
  }

  return (
    <MobileAppShell title="📋 แบบสอบถาม" subtitle="ช่วยพัฒนาบริการให้ดียิ่งขึ้น">
      <div className="mobile-stack">
        {notice && <div style={{ padding:'10px 14px', borderRadius:10, background:'#e8f5e9', color:'#1b5e20', fontSize:13, fontWeight:600 }}>{notice}</div>}
        {surveys.length===0 && <div style={{ textAlign:'center', padding:'40px 0' }}><div style={{ fontSize:48 }}>📋</div><p style={{ margin:'12px 0 0', fontSize:14, color:'#9ca3af' }}>ยังไม่มีแบบสอบถาม</p></div>}
        {surveys.map(s => {
          const isDone = done.has(s.id);
          return (
            <button key={s.id} onClick={()=>!isDone&&setSelected(s)} disabled={isDone} style={{ width:'100%', textAlign:'left', background:isDone?'#f9fafb':'#fff', borderRadius:16, border:`1px solid ${isDone?'#e5e7eb':'#a5d6a7'}`, padding:16, cursor:isDone?'default':'pointer' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div style={{ flex:1 }}>
                  <p style={{ margin:'0 0 4px', fontWeight:800, fontSize:15, color:isDone?'#9ca3af':'#111' }}>{s.title}</p>
                  {s.description && <p style={{ margin:'0 0 8px', fontSize:12, color:'#6b7280' }}>{s.description}</p>}
                  <span style={{ fontSize:11, color:'#9ca3af' }}>{questions.filter(q=>q.survey_id===s.id).length} คำถาม</span>
                </div>
                <span style={{ fontSize:20, marginLeft:12 }}>{isDone?'✅':'›'}</span>
              </div>
            </button>
          );
        })}
      </div>
    </MobileAppShell>
  );
}

export default function SurveysPage() {
  return <ProtectedRoute><SurveysContent /></ProtectedRoute>;
}
