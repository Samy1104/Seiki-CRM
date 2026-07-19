import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-amber text-base hover:bg-amber/90 shadow-[0_2px_10px_var(--color-amber-glow)]',
  secondary: 'bg-elevated text-ink border border-line-strong hover:bg-hover',
  ghost: 'bg-transparent text-ink-soft border border-transparent hover:bg-elevated hover:text-ink',
  danger: 'bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  className = '',
  children,
  ...rest
}) => {
  const classes = [
    'inline-flex items-center justify-center gap-1.5 rounded-overlay font-ui font-semibold',
    'transition-colors duration-150 ease-out cursor-pointer disabled:cursor-not-allowed disabled:opacity-50',
    variantClasses[variant],
    sizeClasses[size],
    className,
  ].join(' ');

  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
};
