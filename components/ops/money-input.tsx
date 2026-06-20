"use client";

import { ChangeEvent, InputHTMLAttributes, useState } from "react";

function moneyDigits(value: string | number | null | undefined) {
  return String(value ?? "").replace(/\D/g, "").replace(/^0+(?=\d)/, "");
}

export function formatMoneyInput(value: string | number | null | undefined) {
  const digits = moneyDigits(value);
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

type MoneyInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "defaultValue" | "inputMode" | "onChange" | "type" | "value"> & {
  defaultValue?: string | number | null;
  value?: string | number | null;
  onValueChange?: (value: string) => void;
};

export function MoneyInput({
  defaultValue,
  value,
  onValueChange,
  ...props
}: MoneyInputProps) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(formatMoneyInput(defaultValue));
  const displayValue = isControlled ? formatMoneyInput(value) : internalValue;

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const digits = moneyDigits(event.target.value);
    const formatted = formatMoneyInput(digits);
    if (!isControlled) setInternalValue(formatted);
    onValueChange?.(digits);
  }

  return (
    <input
      {...props}
      inputMode="numeric"
      type="text"
      value={displayValue}
      onChange={handleChange}
    />
  );
}
