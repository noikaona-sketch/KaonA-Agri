import type { ReactNode } from 'react';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  actions?: ReactNode;
};

export function ConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  actions,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="confirm-dialog" role="dialog" aria-modal="true" aria-label={title}>
      <div className="confirm-dialog__panel">
        <h3 className="confirm-dialog__title">{title}</h3>
        <p className="confirm-dialog__message">{message}</p>
        {actions ?? (
          <div className="confirm-dialog__actions">
            <button type="button" className="ui-button ui-button--ghost" onClick={onCancel}>{cancelLabel}</button>
            <button type="button" className="ui-button ui-button--primary" onClick={onConfirm}>{confirmLabel}</button>
          </div>
        )}
      </div>
    </div>
  );
}
