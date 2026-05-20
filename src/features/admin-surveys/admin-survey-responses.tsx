'use client';
import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export function AdminSurveyResponses(){
  const [rows,setRows]=useState<any[]>([]);
  useEffect(()=>{ void (async()=>{ const s=createSupabaseBrowserClient(); const {data}=await s.from('survey_responses').select('id,submitted_at,surveys(title),members(full_name,phone)').order('submitted_at',{ascending:false}).limit(200); setRows(data??[]); })(); },[]);
  return <div className='kaona-card'><h3>คำตอบแบบสำรวจ</h3><table className='admin-table'><thead><tr><th>แบบสำรวจ</th><th>สมาชิก</th><th>โทร</th><th>เวลา</th></tr></thead><tbody>{rows.map((r)=><tr key={r.id}><td>{r.surveys?.title??'-'}</td><td>{r.members?.full_name??'-'}</td><td>{r.members?.phone??'-'}</td><td>{new Date(r.submitted_at).toLocaleString()}</td></tr>)}</tbody></table></div>
}
