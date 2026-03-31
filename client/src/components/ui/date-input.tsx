import { forwardRef, useState } from "react";
import { format, parse, isValid } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DateInputProps {
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  placeholder?: string;
  "data-testid"?: string;
  id?: string;
  disabled?: boolean;
  name?: string;
  onBlur?: () => void;
  ref?: React.Ref<HTMLButtonElement>;
}

/**
 * Custom date picker that always displays MM/DD/YYYY format.
 * Uses shadcn Calendar + Popover instead of native <input type="date">.
 *
 * Accepts and emits ISO date strings (YYYY-MM-DD).
 * onChange receives the ISO string directly (compatible with react-hook-form field.onChange).
 */
const DateInput = forwardRef<HTMLButtonElement, DateInputProps>(
  ({ value, onChange, className, placeholder, disabled, ...props }, ref) => {
    const [open, setOpen] = useState(false);

    const dateValue = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;
    const isValidDate = dateValue && isValid(dateValue);

    const handleSelect = (day: Date | undefined) => {
      if (day && onChange) {
        onChange(format(day, "yyyy-MM-dd"));
      }
      setOpen(false);
    };

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            ref={ref}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-start text-left font-normal h-9",
              !isValidDate && "text-muted-foreground",
              className
            )}
            data-testid={props["data-testid"]}
          >
            <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
            {isValidDate ? format(dateValue, "MM/dd/yyyy") : (
              <span className="text-muted-foreground">{placeholder || "MM/DD/YYYY"}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={isValidDate ? dateValue : undefined}
            onSelect={handleSelect}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    );
  }
);
DateInput.displayName = "DateInput";

export { DateInput };
export type { DateInputProps };
