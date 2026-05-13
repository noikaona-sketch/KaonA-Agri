import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

// GET — ดูยอดเครดิตทั้งหมด (admin)
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const memberId = url.searchParams.get('member_id');

    const s = createServerSupabaseClient();

    if (memberId) {
      const [acctRes, txnRes] = await Promise.all([
        s.from('member_credit_accounts').select('*').eq('member_id', memberId).maybeSingle(),
        s.from('credit_transactions').select('*').eq('member_id', memberId)
          .order('created_at', { ascending: false }).limit(30),
      ]);
      return NextResponse.json({ account: acctRes.data, transactions: txnRes.data ?? [] });
    }

    // รายการยอดค้างทั้งหมด
    const { data, error } = await s
      .from('member_credit_accounts')
      .select('*, members(full_name, phone)')
      .gt('debit_balance', 0)
      .order('debit_balance', { ascending: false })
      .limit(100);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST — admin เพิ่มเครดิต / บันทึกการชำระ
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action: 'add_credit' | 'record_payment';
      member_id: string;
      amount: number;
      note?: string;
    };

    if (!body.member_id || !body.amount || body.amount <= 0) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });
    }

    const s = createServerSupabaseClient();

    // upsert credit account
    await s.from('member_credit_accounts').upsert(
      { member_id: body.member_id },
      { onConflict: 'member_id', ignoreDuplicates: true }
    );

    const { data: acct } = await s.from('member_credit_accounts')
      .select('balance, debit_balance')
      .eq('member_id', body.member_id)
      .single();

    const current = acct as { balance: number; debit_balance: number } | null;

    if (body.action === 'add_credit') {
      const newBalance = (current?.balance ?? 0) + body.amount;
      await s.from('member_credit_accounts').update({
        balance: newBalance, last_activity: new Date().toISOString(),
      }).eq('member_id', body.member_id);

      await s.from('credit_transactions').insert({
        member_id: body.member_id, txn_type: 'credit_add',
        amount: body.amount, balance_after: newBalance,
        note: body.note ?? 'admin เพิ่มเครดิต',
      });

      await s.from('notifications').insert({
        member_id: body.member_id, title: '💳 ได้รับเครดิต',
        body: `เครดิต +${body.amount.toLocaleString()} บาท${body.note ? ' — ' + body.note : ''}`,
      });
    }

    if (body.action === 'record_payment') {
      const { data: currentAcct } = await s.from('member_credit_accounts')
        .select('total_paid, debit_balance').eq('member_id', body.member_id).single();
      const ca = currentAcct as { total_paid: number; debit_balance: number } | null;
      await s.from('member_credit_accounts').update({
        debit_balance: Math.max(0, (ca?.debit_balance ?? 0) - body.amount),
        total_paid: (ca?.total_paid ?? 0) + body.amount,
        last_activity: new Date().toISOString(),
      }).eq('member_id', body.member_id);

      await s.from('credit_transactions').insert({
        member_id: body.member_id, txn_type: 'payment',
        amount: body.amount, balance_after: current?.balance ?? 0,
        note: body.note ?? 'ชำระหนี้',
      });

      await s.from('notifications').insert({
        member_id: body.member_id, title: '✅ บันทึกการชำระเงิน',
        body: `ชำระ ${body.amount.toLocaleString()} บาท${body.note ? ' — ' + body.note : ''}`,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
