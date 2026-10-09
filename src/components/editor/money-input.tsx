"use client";

import { useId, useState } from "react";
import { formatCents, parseMoney } from "@/engine/money";

interface MoneyInputProps {
  label: string;
  value: number | null;
  onChange: (cents: number | null) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  allowNegative?: boolean;
  compact?: boolean;
  id?: string;
  name?: string;
  autoFocus?: boolean;
}

/**
 * Money field for one-handed use: numeric keypad, paste-tolerant ("$58,714.00", "58.7k"),
 * formats on blur, never turns an empty field into zero.
 */
export function MoneyInput({ label, value, onChange, placeholder = "Not yet quoted", hint, error, required, allowNegative = false, compact = false, id, name, autoFocus }: MoneyInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [text, setText] = useState(() => (value === null ? "" : formatCents(value, { symbol: false })));
  const [focused, setFocused] = useState(false);
  const [lastValue, setLastValue] = useState(value);

  // Keep in sync when the value changes from outside (import, draft restore) while not editing.
  if (value !== lastValue) {
    setLastValue(value);
    if (!focused) setText(value === null ? "" : formatCents(value, { symbol: false }));
  }

  const parsedNow = parseMoney(text);
  const invalid = text.trim() !== "" && parsedNow === null;
  const signDropped = !allowNegative && parsedNow !== null && parsedNow < 0;

  return (
    <div className={compact ? "" : "flex flex-col gap-1"}>
      <label htmlFor={inputId} className={compact ? "sr-only" : "text-sm font-medium"}>
        {label}
      </label>
      <div className="relative">
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-2">
          $
        </span>
        <input
          id={inputId}
          name={name}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          autoFocus={autoFocus}
          enterKeyHint="next"
          className="field num pl-7 text-right"
          value={text}
          placeholder={placeholder}
          required={required}
          aria-invalid={invalid || !!error ? "true" : undefined}
          aria-describedby={hint || error || signDropped ? `${inputId}-desc` : undefined}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            const parsed = parseMoney(text);
            if (parsed !== null) {
              const clamped = allowNegative ? parsed : Math.abs(parsed);
              setText(formatCents(clamped, { symbol: false }));
              if (clamped !== value) onChange(clamped);
            } else if (text.trim() === "" && value !== null) {
              onChange(null);
            }
          }}
          onChange={(e) => {
            const next = e.target.value;
            setText(next);
            const parsed = parseMoney(next);
            if (next.trim() === "") onChange(null);
            else if (parsed !== null) onChange(allowNegative ? parsed : Math.abs(parsed));
          }}
        />
      </div>
      {(hint || error || signDropped) && (
        <p id={`${inputId}-desc`} className={`text-xs ${error ? "text-flag" : "text-ink-2"}`}>
          {error ?? (signDropped ? "Entered as a positive amount; this field has no negative values." : hint)}
        </p>
      )}
    </div>
  );
}
