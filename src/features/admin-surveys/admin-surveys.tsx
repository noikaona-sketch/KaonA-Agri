'use client';
import { useEffect, useState } from 'react';

type QType = 'text'|'number'|'yes_no'|'choice';

export function AdminSurveys() {
  const [title,setTitle]=useState(''); const [description,setDescription]=useState('');
  const [questions,setQuestions]=useState([{question_text:'',question_type:'text' as QType,choices:''}]);
  const [list,setList]=useState<any[]>([]); const [notice,setNotice]=useState('');

  async function load(){ const res=await fetch('/api/admin/surveys', { credentials: 'include' }); const j=await res.json(); setList(j.surveys??[]); }
  useEffect(()=>{void load();},[]);
  async function submit(){
    const payload={title,description,questions:questions.map((q)=>({...q,choices:q.question_type==='choice'?q.choices.split(',').map(s=>s.trim()).filter(Boolean):null}))};
    const res=await fetch('/api/admin/surveys', { credentials: 'include', method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    if(res.ok){setNotice('สร้างแบบสำรวจแล้ว');setTitle('');setDescription('');setQuestions([{question_text:'',question_type:'text',choices:''}]);void load();}
    else { const j=await res.json(); setNotice(j.error??'error'); }
  }
  return <div>
    {notice && <p>{notice}</p>}
    <div className='kaona-card' style={{marginBottom:16}}>
      <h3>สร้างแบบสำรวจ</h3>
      <input className='admin-input' placeholder='ชื่อแบบสำรวจ' value={title} onChange={e=>setTitle(e.target.value)} />
      <textarea className='admin-input' placeholder='รายละเอียด' value={description} onChange={e=>setDescription(e.target.value)} />
      {questions.map((q,i)=><div key={i} style={{borderTop:'1px solid #eee',paddingTop:8,marginTop:8}}>
        <input className='admin-input' placeholder='คำถาม' value={q.question_text} onChange={e=>setQuestions(prev=>prev.map((x,idx)=>idx===i?{...x,question_text:e.target.value}:x))} />
        <select className='admin-select' value={q.question_type} onChange={e=>setQuestions(prev=>prev.map((x,idx)=>idx===i?{...x,question_type:e.target.value as QType}:x))}>
          <option value='text'>text</option><option value='number'>number</option><option value='yes_no'>yes_no</option><option value='choice'>choice</option>
        </select>
        {q.question_type==='choice' && <input className='admin-input' placeholder='ตัวเลือกคั่นด้วย comma' value={q.choices} onChange={e=>setQuestions(prev=>prev.map((x,idx)=>idx===i?{...x,choices:e.target.value}:x))} />}
      </div>)}
      <button className='admin-btn' onClick={()=>setQuestions(prev=>[...prev,{question_text:'',question_type:'text',choices:''}])}>+ เพิ่มคำถาม</button>
      <button className='admin-btn admin-btn--primary' onClick={()=>void submit()}>บันทึก</button>
    </div>
    <div className='kaona-card'><h3>รายการแบบสำรวจ</h3>{list.map((s)=><p key={s.id}>{s.title}</p>)}</div>
  </div>;
}
