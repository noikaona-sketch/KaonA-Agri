import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

export async function GET(request: Request) {
  try {
    const s = createServerSupabaseClient();
    const { data: { user } } = await s.auth.getUser();
    if (!user) return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });

    const { data: member } = await s.from('members')
      .select('id').eq('auth_user_id', user.id).maybeSingle();
    if (!member) return NextResponse.json({ error: 'ไม่พบสมาชิก' }, { status: 404 });

    const memberId = (member as { id: string }).id;

    const [acctRes, txnRes] = await Promise.all([
      s.from('member_credit_accounts').select('balance,debit_balance,total_spent,total_paid,last_activity')
        .eq('member_id', memberId).maybeSingle(),
      s.from('credit_transactions').select('id,txn_type,amount,balance_after,note,created_at')
        .eq('member_id', memberId).order('created_at', { ascending: false }).limit(20),
    ]);

    return NextResponse.json({
      account: acctRes.data ?? { balance: 0, debit_balance: 0, total_spent: 0, total_paid: 0 },
      transactions: txnRes.data ?? [],
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
