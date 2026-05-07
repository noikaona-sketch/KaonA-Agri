import { FormSheet } from '@/shared/components/form-sheet';
import { UIButton } from '@/shared/components/ui-button';

import type { NoBurnRequestOption, PlotOption } from './types';

type ResultFormProps = {
  loading: boolean;
  submitting: boolean;
  noBurnRequests: NoBurnRequestOption[];
  plots: PlotOption[];
  selectedNoBurnRequestId: string;
  selectedPlotId: string;
  note: string;
  onNoBurnChange: (value: string) => void;
  onPlotChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onSubmit: () => void;
};

export function ResultForm(props: ResultFormProps) {
  const { loading, submitting, noBurnRequests, plots, selectedNoBurnRequestId, selectedPlotId, note, onNoBurnChange, onPlotChange, onNoteChange, onSubmit } = props;

  return (
    <FormSheet title="สร้างงานตรวจแปลง" footer={<UIButton onClick={onSubmit} loading={submitting} disabled={submitting || loading} fullWidth>สร้างงานตรวจ</UIButton>}>
      <label>คำขอ no-burn ที่เกี่ยวข้อง
        <select value={selectedNoBurnRequestId} onChange={(e) => onNoBurnChange(e.target.value)} disabled={submitting || loading}>
          <option value="">ไม่ระบุ</option>
          {noBurnRequests.map((request) => <option key={request.id} value={request.id}>คำขอ {request.id.slice(0, 8)}... ({request.status})</option>)}
        </select>
      </label>
      <label>แปลงที่เกี่ยวข้อง
        <select value={selectedPlotId} onChange={(e) => onPlotChange(e.target.value)} disabled={submitting || loading}>
          <option value="">ไม่ระบุ</option>
          {plots.map((plot) => <option key={plot.id} value={plot.id}>{plot.plot_name ?? plot.name ?? plot.id.slice(0, 8)}</option>)}
        </select>
      </label>
      <label>บันทึกสั้นๆ
        <textarea rows={3} value={note} onChange={(e) => onNoteChange(e.target.value)} disabled={submitting || loading} />
      </label>
    </FormSheet>
  );
}
