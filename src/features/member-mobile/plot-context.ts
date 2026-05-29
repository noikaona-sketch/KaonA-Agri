export const MISSING_PLOT_MESSAGE = 'ยังไม่พบแปลง กรุณาเพิ่มแปลงก่อน';
export const INVALID_PLOT_ID_MESSAGE = 'ไม่พบแปลงที่เลือก กรุณาเลือกแปลงใหม่';
export const SESSION_EXPIRED_MESSAGE = 'กรุณาเปิดแอปใหม่';

export type MemberPlot = {
  id: string;
  name: string;
  area_rai: number;
  province: string | null;
  status?: string | null;
  land_doc_type?: string | null;
  lat?: number | null;
  lng?: number | null;
  [key: string]: unknown;
};

export type PlotContext = {
  requestedPlotId: string;
  selectedPlot: MemberPlot | null;
  selectedPlotId: string;
  invalidPlotId: boolean;
  warning: string | null;
};

export function normalizePlotId(plotId: string | null | undefined) {
  return plotId?.trim() ?? '';
}

export function resolvePlotContext(plots: MemberPlot[], requestedPlotId?: string | null): PlotContext {
  const normalizedPlotId = normalizePlotId(requestedPlotId);

  if (!normalizedPlotId) {
    return {
      requestedPlotId: '',
      selectedPlot: null,
      selectedPlotId: '',
      invalidPlotId: false,
      warning: null,
    };
  }

  const selectedPlot = plots.find((plot) => plot.id === normalizedPlotId) ?? null;

  return {
    requestedPlotId: normalizedPlotId,
    selectedPlot,
    selectedPlotId: selectedPlot?.id ?? '',
    invalidPlotId: !selectedPlot,
    warning: selectedPlot ? null : INVALID_PLOT_ID_MESSAGE,
  };
}

export function buildPlotActionHref(path: string, plotId?: string | null) {
  const normalizedPlotId = normalizePlotId(plotId);
  if (!normalizedPlotId) return path;
  const params = new URLSearchParams({ plot_id: normalizedPlotId });
  return `${path}?${params.toString()}`;
}
