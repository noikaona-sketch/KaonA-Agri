import { NextResponse } from 'next/server';

export function createDiagnosticRequestId() {
  return `diag_${crypto.randomUUID()}`;
}

export function jsonWithDiagnostic(
  body: Record<string, unknown>,
  diagnosticRequestId: string,
  init?: ResponseInit,
) {
  return NextResponse.json(
    { ...body, diagnostic_request_id: diagnosticRequestId },
    init,
  );
}

export async function appendDiagnosticToJsonResponse(
  response: Response,
  diagnosticRequestId: string,
) {
  let body: Record<string, unknown> = {};

  try {
    const parsed = await response.clone().json();
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      body = parsed as Record<string, unknown>;
    } else {
      body = { error: String(parsed) };
    }
  } catch {
    body = { error: response.statusText || 'Request failed' };
  }

  return jsonWithDiagnostic(body, diagnosticRequestId, { status: response.status });
}
