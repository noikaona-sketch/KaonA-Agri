import { InfoCard } from '@/shared/components/info-card';

type MemberProfileSummaryCardProps = {
  title: string;
  value: string;
  subtitle: string;
};

export function MemberProfileSummaryCard({ title, value, subtitle }: MemberProfileSummaryCardProps) {
  return <InfoCard title={`${value}`} subtitle={subtitle} meta={<span>{title}</span>} />;
}
