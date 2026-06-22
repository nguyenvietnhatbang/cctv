"use client";

import { ChangeEvent, InputHTMLAttributes, useState } from "react";

function normalizeInitialMoneyValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "";

  const source = String(value).trim();
  const normalized = source.includes(",")
    ? source.replace(/\./g, "").replace(",", ".")
    : /^\d+\.\d{0,2}$/.test(source)
      ? source
      : source.replace(/\D/g, "");

  const [integerPart = "", decimalPart] = normalized.split(".");
  const integerDigits = integerPart.replace(/\D/g, "").replace(/^0+(?=\d)/, "") || "0";
  if (decimalPart === undefined) return integerDigits;
  return `${integerDigits}.${decimalPart.replace(/\D/g, "").slice(0, 2)}`;
}

export function formatMoneyInput(value: string | number | null | undefined) {
  const normalized = normalizeInitialMoneyValue(value);
  if (!normalized) return "";

  const [integerPart, decimalPart] = normalized.split(".");
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return decimalPart === undefined ? formattedInteger : `${formattedInteger},${decimalPart}`;
}

function normalizeDisplayedMoneyValue(value: string) {
  const [integerPart = "", ...decimalParts] = value.split(",");
  const integerDigits = integerPart.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  const decimalDigits = decimalParts.join("").replace(/\D/g, "").slice(0, 2);

  if (!integerDigits && decimalParts.length === 0) return "";
  const normalizedInteger = integerDigits || "0";
  return decimalParts.length > 0 ? `${normalizedInteger}.${decimalDigits}` : normalizedInteger;
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
    const normalized = normalizeDisplayedMoneyValue(event.target.value);
    const formatted = formatMoneyInput(normalized);
    if (!isControlled) setInternalValue(formatted);
    onValueChange?.(normalized);
  }

  return (
    <input
      {...props}
      inputMode="decimal"
      type="text"
      value={displayValue}
      onChange={handleChange}
    />
  );
}
