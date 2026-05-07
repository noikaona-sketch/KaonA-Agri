export type InspectionResultStatus = 'pending' | 'assigned' | 'passed' | 'failed' | 'needs_update' | 'completed';

export type InspectionTaskRow = {
  id: string;
  no_burn_request_id: string | null;
  plot_id: string | null;
  inspector_member_id: string;
  assigned_at: string | null;
  visited_at: string | null;
  result_status: InspectionResultStatus;
  result_note: string | null;
  created_at: string;
};

export type NoBurnRequestOption = {
  id: string;
  status: string;
};

export type PlotOption = {
  id: string;
  plot_name: string | null;
  name: string | null;
};
