import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  useId
} from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  }, []);

  const unregisterItem = useCallback((val: string) => {
    delete itemsRef.current[val];
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

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
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
      contentRef,
      triggerId,
      contentId,
      disabled,
      onValueChange
    } = useSelectContext();

    // Expose ref to both context and internal forwardRef
    React.useImperativeHandle(ref, () => triggerRef.current as HTMLButtonElement);

    const getOptions = () => {
      if (!contentRef.current) return [];
      return Array.from(
        contentRef.current.querySelectorAll('[data-select-item]:not([data-disabled="true"])')
      ) as HTMLElement[];
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return;

      if (!open) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setOpen(true);
        }
        return;
      }

      const options = getOptions();
      if (options.length === 0) return;

      const currentIndex = options.findIndex(el => el.getAttribute('data-value') === focusedValue);

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % options.length;
          const nextVal = options[nextIndex].getAttribute('data-value');
          if (nextVal) {
            setFocusedValue(nextVal);
            options[nextIndex].scrollIntoView?.({ block: 'nearest' });
          }
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          const prevIndex = currentIndex === -1 ? options.length - 1 : (currentIndex - 1 + options.length) % options.length;
          const prevVal = options[prevIndex].getAttribute('data-value');
          if (prevVal) {
            setFocusedValue(prevVal);
            options[prevIndex].scrollIntoView?.({ block: 'nearest' });
          }
          break;
        }
        case 'Enter':
        case ' ': {
          e.preventDefault();
          if (focusedValue) {
            onValueChange?.(focusedValue);
            setOpen(false);
          }
          break;
        }
        case 'Escape': {
          e.preventDefault();
          setOpen(false);
          break;
        }
        case 'Tab': {
          setOpen(false);
          break;
        }
      }
    };

    const handleTriggerClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      setOpen(!open);
      onClick?.(e);
    };

    const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      handleKeyDown(e);
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
        aria-activedescendant={focusedValue ? `${contentId}-option-${focusedValue}` : undefined}
        disabled={disabled}
        {...props}
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink hover:bg-hover focus:outline-none focus:border-line-focus disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 cursor-pointer",
          className
        )}
      >
        <span className="flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap">
          {children}
        </span>
        <ChevronDown
          size={16}
          className={cn(
            "text-ink-faint transition-transform duration-200 flex-shrink-0 ml-2",
            open && "transform rotate-180 text-ink"
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
  ({ children, className, ...props }, ref) => {
    const { open, contentRef, contentId, triggerId, value, setFocusedValue } = useSelectContext();

    React.useImperativeHandle(ref, () => contentRef.current as HTMLDivElement);

    // Visual highlighted initial index selection on open
    useEffect(() => {
      if (open) {
        if (value) {
          setFocusedValue(value);
          // Scroll the active item into view on open
          requestAnimationFrame(() => {
            if (contentRef.current) {
              const activeEl = contentRef.current.querySelector(`[data-value="${value}"]`);
              activeEl?.scrollIntoView?.({ block: 'nearest' });
            }
          });
        } else {
          // Highlight first option
          if (contentRef.current) {
            const options = contentRef.current.querySelectorAll('[data-select-item]:not([data-disabled="true"])');
            if (options.length > 0) {
              const firstVal = options[0].getAttribute('data-value');
              setFocusedValue(firstVal);
            }
          }
        }
      } else {
        setFocusedValue(null);
      }
    }, [open, value, setFocusedValue, contentRef]);

    return (
      <AnimatePresence>
        {open && (
          <motion.div
            ref={contentRef}
            id={contentId}
            role="listbox"
            aria-labelledby={triggerId}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "absolute z-50 mt-1.5 max-h-60 min-w-full w-max overflow-y-auto overflow-x-hidden rounded-control border border-line bg-surface p-1 shadow-modal focus:outline-none scrollbar-thin top-full left-0",
              className
            )}
            style={{
              transformOrigin: 'top center',
            }}
            {...(props as any)}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
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
          "relative flex w-full cursor-pointer select-none items-center rounded-control py-1.5 pl-8 pr-2 text-sm text-ink outline-none transition-colors duration-150",
          disabled && "pointer-events-none opacity-50 cursor-not-allowed",
          isHighlighted && "bg-hover text-ink",
          isSelected && "bg-amber-soft text-ink font-medium",
          className
        )}
      >
        {isSelected && (
          <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center text-amber">
            <Check size={14} strokeWidth={3} />
          </span>
        )}
        <span className="truncate">{children}</span>
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
