import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  useId
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

// Helper to join classes
const cn = (...classes: (string | undefined | null | false)[]) => {
  return classes.filter(Boolean).join(' ');
};

interface SelectContextProps {
  value?: string;
  onValueChange?: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
  focusedValue: string | null;
  setFocusedValue: (value: string | null) => void;
  staticRegistry: Record<string, { label: React.ReactNode; textValue?: string }>;
  itemsRef: React.RefObject<Record<string, { label: React.ReactNode; textValue?: string }>>;
  optionValuesRef: React.RefObject<string[]>;
  registerItem: (value: string, label: React.ReactNode, textValue?: string) => void;
  unregisterItem: (value: string) => void;
  triggerId: string;
  contentId: string;
  disabled?: boolean;
}

const SelectContext = createContext<SelectContextProps | null>(null);

export function useSelectContext() {
  const context = useContext(SelectContext);
  if (!context) {
    throw new Error('Select compound components must be rendered within a Select component');
  }
  return context;
}

export interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
  disabled?: boolean;
}

// Helper to recursively find SelectItem children and build static registry
const findSelectItems = (children: React.ReactNode): Record<string, { label: React.ReactNode; textValue?: string }> => {
  const registry: Record<string, { label: React.ReactNode; textValue?: string }> = {};

  const traverse = (node: React.ReactNode) => {
    React.Children.forEach(node, child => {
      if (!React.isValidElement(child)) return;

      const type = child.type as any;
      if (type?.displayName === 'SelectItem') {
        const { value, children: label, textValue } = child.props as any;
        if (value !== undefined) {
          registry[value] = { label, textValue };
        }
      } else if (child.props && (child.props as any).children) {
        traverse((child.props as any).children);
      }
    });
  };

  traverse(children);
  return registry;
};

export const Select: React.FC<SelectProps> = ({
  value,
  defaultValue,
  onValueChange,
  open,
  onOpenChange,
  children,
  disabled = false
}) => {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const isControlledValue = value !== undefined;
  const activeValue = isControlledValue ? value : uncontrolledValue;

  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlledOpen = open !== undefined;
  const activeOpen = isControlledOpen ? open : uncontrolledOpen;

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const [focusedValue, setFocusedValue] = useState<string | null>(null);
  const itemsRef = useRef<Record<string, { label: React.ReactNode; textValue?: string }>>({});
  const optionValuesRef = useRef<string[]>([]);

  const staticRegistry = React.useMemo(() => findSelectItems(children), [children]);

  const triggerId = useId();
  const contentId = useId();

  const handleValueChange = useCallback(
    (val: string) => {
      if (!isControlledValue) {
        setUncontrolledValue(val);
      }
      onValueChange?.(val);
    },
    [isControlledValue, onValueChange]
  );

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!isControlledOpen) {
        setUncontrolledOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [isControlledOpen, onOpenChange]
  );

  const registerItem = useCallback((val: string, label: React.ReactNode, textValue?: string) => {
    itemsRef.current[val] = { label, textValue };
    if (!optionValuesRef.current.includes(val)) {
      optionValuesRef.current.push(val);
    }
  }, []);

  const unregisterItem = useCallback((_val: string) => {
    // Retain registry and optionValuesRef so keyboard navigation and SelectValue remain functional when content closes
  }, []);

  // Click outside handling
  useEffect(() => {
    if (!activeOpen) return;

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (
        triggerRef.current?.contains(target) ||
        contentRef.current?.contains(target)
      ) {
        return;
      }
      handleOpenChange(false);
    };

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [activeOpen, handleOpenChange]);

  const contextValue: SelectContextProps = {
    value: activeValue,
    onValueChange: handleValueChange,
    open: activeOpen,
    setOpen: handleOpenChange,
    triggerRef,
    contentRef,
    focusedValue,
    setFocusedValue,
    staticRegistry,
    itemsRef,
    optionValuesRef,
    registerItem,
    unregisterItem,
    triggerId,
    contentId,
    disabled
  };

  return (
    <SelectContext.Provider value={contextValue}>
      <div className="relative w-full">{children}</div>
    </SelectContext.Provider>
  );
};

export interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
}

export const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ children, className, onClick, onKeyDown, ...props }, ref) => {
    const {
      open,
      setOpen,
      triggerRef,
      focusedValue,
      setFocusedValue,
      triggerId,
      contentId,
      disabled,
      onValueChange,
      optionValuesRef
    } = useSelectContext();

    // Expose ref to both context and internal forwardRef
    React.useImperativeHandle(ref, () => triggerRef.current as HTMLButtonElement);

    const handleKeyDown = useCallback((e: KeyboardEvent | React.KeyboardEvent) => {
      if (disabled) return;

      const keys = optionValuesRef.current;

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
        e.preventDefault();
      }

      if (!open) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
          setOpen(true);
        }
        return;
      }

      if (keys.length === 0) return;

      const curr = keys.indexOf(focusedValue ?? '');

      switch (e.key) {
        case 'ArrowDown': {
          const nextIndex = curr === -1 ? 0 : (curr + 1) % keys.length;
          setFocusedValue(keys[nextIndex]);
          break;
        }
        case 'ArrowUp': {
          const prevIndex = curr === -1 ? keys.length - 1 : (curr - 1 + keys.length) % keys.length;
          setFocusedValue(keys[prevIndex]);
          break;
        }
        case 'Enter':
        case ' ': {
          if (focusedValue !== null && focusedValue !== undefined) {
            onValueChange?.(focusedValue);
            setOpen(false);
          }
          break;
        }
        case 'Escape': {
          setOpen(false);
          break;
        }
        case 'Tab': {
          setOpen(false);
          break;
        }
      }
    }, [disabled, open, focusedValue, setOpen, onValueChange, setFocusedValue, optionValuesRef]);

    // Single global keyboard listener when open
    useEffect(() => {
      if (!open) return;
      const onGlobalKeyDown = (e: KeyboardEvent) => {
        handleKeyDown(e);
      };
      window.addEventListener('keydown', onGlobalKeyDown);
      return () => window.removeEventListener('keydown', onGlobalKeyDown);
    }, [open, handleKeyDown]);

    const handleTriggerClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      setOpen(!open);
      onClick?.(e);
    };

    const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (!open) {
        handleKeyDown(e);
      }
      onKeyDown?.(e);
    };

    return (
      <button
        ref={triggerRef}
        type="button"
        id={triggerId}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? contentId : undefined}
        aria-activedescendant={focusedValue !== null ? `${contentId}-option-${focusedValue}` : undefined}
        disabled={disabled}
        {...props}
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-xl border border-[rgba(242,237,228,0.12)] bg-[#0d0d0d] px-3.5 py-2 text-[12px] text-[#f2ede4] hover:bg-[#161616] focus:outline-none transition-all duration-200 cursor-pointer",
          open && "border-[var(--color-beige,#D4C4A8)]",
          className
        )}
        style={{
          ...props.style,
        }}
      >
        <span className="flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap">
          {children}
        </span>
        <ChevronDown
          size={14}
          className={cn(
            "text-[#666] transition-transform duration-200 flex-shrink-0 ml-2",
            open && "transform rotate-180 text-[var(--color-beige,#D4C4A8)]"
          )}
        />
      </button>
    );
  }
);
SelectTrigger.displayName = 'SelectTrigger';

export interface SelectValueProps {
  placeholder?: string;
  className?: string;
}

export const SelectValue: React.FC<SelectValueProps> = ({ placeholder, className }) => {
  const { value, staticRegistry, itemsRef } = useSelectContext();

  const item = value !== undefined ? (staticRegistry[value] || itemsRef.current?.[value]) : undefined;
  const displayContent = item ? item.label : placeholder;

  return (
    <span className={cn("block truncate text-left", className)}>
      {displayContent}
    </span>
  );
};

export interface SelectContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const SelectContent = React.forwardRef<HTMLDivElement, SelectContentProps>(
  ({ children, className, style, ...props }, ref) => {
    const { open, contentRef, contentId, triggerId, value, setFocusedValue, triggerRef } = useSelectContext();
    const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

    React.useImperativeHandle(ref, () => contentRef.current as HTMLDivElement);

    React.useLayoutEffect(() => {
      if (open && triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setPos({
          top: rect.bottom + 6,
          left: rect.left,
          width: Math.max(rect.width, 180),
        });
      }
    }, [open, triggerRef]);

    useEffect(() => {
      if (open) {
        if (value !== undefined) {
          setFocusedValue(value);
        }
      } else {
        setFocusedValue(null);
      }
    }, [open, value, setFocusedValue]);

    if (!open) return null;

    const rect = triggerRef.current ? triggerRef.current.getBoundingClientRect() : null;
    const top = rect ? rect.bottom + 6 : pos.top;
    const left = rect ? rect.left : pos.left;
    const width = rect ? Math.max(rect.width, 180) : Math.max(pos.width, 180);

    return createPortal(
      <div
        ref={contentRef}
        id={contentId}
        role="listbox"
        aria-labelledby={triggerId}
        {...props}
        className={cn(
          "fixed py-2 overflow-hidden max-h-[300px] overflow-y-auto outline-none focus:outline-none scrollbar-thin",
          className
        )}
        style={{
          background: "#111",
          borderTop: "1px solid var(--color-beige, #D4C4A8)",
          borderLeft: "1px solid rgba(242,237,228,0.08)",
          borderRight: "1px solid rgba(242,237,228,0.08)",
          borderBottom: "1px solid rgba(242,237,228,0.08)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.7)",
          fontFamily: "'Inter', sans-serif",
          userSelect: "none",
          borderRadius: 0,
          ...style,
          position: "fixed",
          top,
          left,
          width,
          zIndex: 9999,
        }}
      >
        {children}
      </div>,
      document.body
    );
  }
);
SelectContent.displayName = 'SelectContent';

export interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  disabled?: boolean;
  textValue?: string;
}

export const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>(
  ({
    children,
    value,
    disabled = false,
    textValue,
    className,
    onClick,
    onPointerMove,
    onKeyDown,
    onMouseEnter,
    ...props
  }, ref) => {
    const {
      value: selectedValue,
      onValueChange,
      setOpen,
      focusedValue,
      setFocusedValue,
      registerItem,
      unregisterItem,
      contentId,
      triggerRef
    } = useSelectContext();

    const isSelected = selectedValue === value;
    const isHighlighted = focusedValue === value;

    const localRef = useRef<HTMLDivElement | null>(null);

    const setRefs = useCallback(
      (node: HTMLDivElement | null) => {
        localRef.current = node;
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }
      },
      [ref]
    );

    // Auto scroll into view when highlighted
    useEffect(() => {
      if (isHighlighted && localRef.current) {
        localRef.current.scrollIntoView({ block: 'nearest' });
      }
    }, [isHighlighted]);

    // Register this item in the context registry so SelectValue can display it when selected
    useEffect(() => {
      registerItem(value, children, textValue);
      return () => {
        unregisterItem(value);
      };
    }, [value, children, textValue, registerItem, unregisterItem]);

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled) return;
      onValueChange?.(value);
      setOpen(false);
      triggerRef.current?.focus();
      onClick?.(e);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (focusedValue !== value) {
        setFocusedValue(value);
      }
      onPointerMove?.(e);
    };

    return (
      <div
        ref={setRefs}
        id={`${contentId}-option-${value}`}
        role="option"
        aria-selected={isSelected}
        aria-disabled={disabled}
        data-select-item
        data-value={value}
        data-disabled={disabled ? "true" : undefined}
        {...props}
        onClick={handleClick}
        onPointerMove={handlePointerMove}
        onKeyDown={onKeyDown}
        onMouseEnter={onMouseEnter}
        className={cn(
          "w-full flex items-center justify-between px-4 py-2.5 text-[13px] transition-colors duration-150 cursor-pointer text-left outline-none focus:outline-none focus-visible:outline-none focus:ring-0",
          disabled && "pointer-events-none opacity-50 cursor-not-allowed",
          className
        )}
        style={{
          color: isSelected || isHighlighted ? "var(--color-beige, #D4C4A8)" : "#b0afa8",
          background: isHighlighted
            ? "rgba(212,196,168,0.12)"
            : isSelected
            ? "rgba(212,196,168,0.06)"
            : "transparent",
          fontWeight: isSelected ? 600 : 400,
          outline: "none",
        }}
      >
        <span>{children}</span>
        {isSelected && (
          <Check size={13} strokeWidth={2} style={{ color: "var(--color-beige, #D4C4A8)" }} />
        )}
      </div>
    );
  }
);
SelectItem.displayName = 'SelectItem';

export interface SelectGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const SelectGroup = React.forwardRef<HTMLDivElement, SelectGroupProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <div ref={ref} role="group" className={cn("p-1", className)} {...props}>
        {children}
      </div>
    );
  }
);
SelectGroup.displayName = 'SelectGroup';

export interface SelectLabelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const SelectLabel = React.forwardRef<HTMLDivElement, SelectLabelProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "py-1.5 pl-8 pr-2 text-xs font-semibold text-ink-faint uppercase tracking-wider",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
SelectLabel.displayName = 'SelectLabel';
