import { AdminSurveyResponses } from '@/features/admin-surveys/admin-survey-responses';
import { AdminWebShell } from '@/shared/components/admin-web-shell';
export default function Page(){ return <AdminWebShell title='คำตอบแบบสำรวจ' subtitle='รายการคำตอบสมาชิก'><AdminSurveyResponses/></AdminWebShell>; }
