import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type UIButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
  loading?: boolean;
  fullWidth?: boolean;
};

export function UIButton({
  children,
  variant = 'primary',
  loading = false,
  fullWidth = false,
  disabled,
  className,
  ...props
}: UIButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      {...props}
      disabled={isDisabled}
      className={[
        'ui-button',
        `ui-button--${variant}`,
        fullWidth ? 'ui-button--full-width' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-busy={loading}
    >
      {loading ? 'Loading…' : children}
    </button>
  );
}
