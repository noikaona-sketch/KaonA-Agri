import { MemberProfileSummaryCard } from './member-profile-summary-card';

type MemberParticipationSummaryProps = {
  plotCount: number;
  cycleCount: number;
  noBurnCount: number;
};

export function MemberParticipationSummary({ plotCount, cycleCount, noBurnCount }: MemberParticipationSummaryProps) {
  return (
    <>
      <MemberProfileSummaryCard title="แปลงปลูก" value={`${plotCount}`} subtitle="จำนวนแปลงที่ลงทะเบียน" />
      <MemberProfileSummaryCard title="รอบเพาะปลูก" value={`${cycleCount}`} subtitle="จำนวนรอบเพาะปลูกทั้งหมด" />
      <MemberProfileSummaryCard title="เข้าร่วมงดเผา" value={`${noBurnCount}`} subtitle="จำนวนครั้งที่เข้าร่วม" />
    </>
  );
}
