'use client';

import { useEffect } from 'react';

type DrawerProps = {
  open     : boolean
  onClose  : () => void
  title    : string
  width?   : number
  children : React.ReactNode
};

export function Drawer({ open, onClose, title, width = 520, children }: DrawerProps) {
  // ป้องกัน scroll หน้าหลักเมื่อ drawer เปิด
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose}
        style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', zIndex:200, backdropFilter:'blur(2px)' }} />

      {/* Drawer panel */}
      <div style={{
        position:'fixed', top:0, right:0, height:'100vh', width, maxWidth:'100vw',
        background:'#fff', zIndex:201, display:'flex', flexDirection:'column',
        boxShadow:'-4px 0 32px rgba(0,0,0,0.15)',
        animation:'slideIn .22s cubic-bezier(.4,0,.2,1)',
      }}>
        <style>{`@keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 24px', borderBottom:'1px solid #e5e7eb', flexShrink:0 }}>
          <h2 style={{ margin:0, fontSize:17, fontWeight:700, color:'#111' }}>{title}</h2>
          <button onClick={onClose}
            style={{ background:'none', border:'none', cursor:'pointer', fontSize:22, color:'#9ca3af', padding:'4px 8px', borderRadius:6, lineHeight:1 }}
            aria-label="ปิด">✕</button>
        </div>

        {/* Content */}
        <div style={{ flex:1, overflowY:'auto', padding:'24px' }}>
          {children}
        </div>
      </div>
    </>
  );
}
