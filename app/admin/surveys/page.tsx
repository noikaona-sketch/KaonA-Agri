import { AdminSurveys } from '@/features/admin-surveys/admin-surveys';
import { AdminWebShell } from '@/shared/components/admin-web-shell';
export default function Page(){ return <AdminWebShell title='แบบสำรวจภาคสนาม' subtitle='สร้างแบบสำรวจอย่างง่าย'><AdminSurveys/></AdminWebShell>; }
