import { MasterpiecePageContent } from '@/features/member-planting/masterpiece-page-content';

export default function MasterpiecePage({ params }: { params: { id: string } }) {
  return <MasterpiecePageContent plotId={params.id} />;
}
