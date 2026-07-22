import React from 'react';

export type AccentButtonVariant = 'primary' | 'secondary';

export interface AccentButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: AccentButtonVariant;
  icon?: React.ReactNode;
}

const variantStyle: Record<AccentButtonVariant, React.CSSProperties> = {
  primary: {
    background: "var(--color-beige, #D4C4A8)",
    color: "#0d0d0d",
    border: "1px solid transparent",
    boxShadow: "0 2px 8px rgba(212, 196, 168, 0.15)",
  },
  secondary: {
    background: "transparent",
    color: "var(--color-beige, #D4C4A8)",
    border: "1px solid rgba(212,196,168,0.25)",
  },
};

export const AccentButton: React.FC<AccentButtonProps> = ({
  variant = 'primary',
  icon,
  children,
  className = '',
  type = 'button',
  ...rest
}) => {
  return (
    <button
      type={type}
      className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md text-[12px] uppercase tracking-[0.12em] font-semibold transition-all duration-150 cursor-pointer hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      style={variantStyle[variant]}
      {...rest}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
};
