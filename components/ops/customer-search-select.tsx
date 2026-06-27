"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { apiFetch } from "@/components/ops/api";
import type { Customer } from "@/components/ops/types";

export function CustomerSearchSelect({
  label = "Khách hàng",
  value,
  customers,
  onChange,
  onChangeComplete,
  className = "",
}: {
  label?: string;
  value: string;
  customers: Customer[];
  onChange: (customerId: string) => void;
  onChangeComplete?: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<Customer[]>(() => customers.slice(0, 25));
  const [total, setTotal] = useState(customers.length);
  const [isLoading, setIsLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const selectedCustomer = useMemo(
    () => options.find((customer) => customer.id === value)
      ?? customers.find((customer) => customer.id === value)
      ?? null,
    [customers, options, value],
  );

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    setOptions((current) => {
      const merged = new Map([...customers.slice(0, 25), ...current].map((customer) => [customer.id, customer]));
      return [...merged.values()].slice(0, 25);
    });
    setTotal((current) => Math.max(current, customers.length));
  }, [customers]);

  useEffect(() => {
    if (!open) return;

    let active = true;
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "25",
      });
      if (query.trim()) params.set("q", query.trim());

      setIsLoading(true);
      apiFetch<{ customers: Customer[]; total: number }>(`/api/customers?${params.toString()}`)
        .then((payload) => {
          if (!active) return;
          setOptions((current) => {
            const selected = value
              ? current.find((customer) => customer.id === value)
                ?? customers.find((customer) => customer.id === value)
              : null;
            const merged = new Map(payload.customers.map((customer) => [customer.id, customer]));
            if (selected) merged.set(selected.id, selected);
            return [...merged.values()].sort((left, right) => left.name.localeCompare(right.name, "vi", { sensitivity: "base" }));
          });
          setTotal(payload.total);
        })
        .catch(() => undefined)
        .finally(() => {
          if (active) setIsLoading(false);
        });
    }, query ? 250 : 0);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [customers, open, query, value]);

  function selectCustomer(customerId: string) {
    onChange(customerId);
    onChangeComplete?.();
    setOpen(false);
  }

  return (
    <div className={`searchable-filter ${className}`.trim()} ref={rootRef}>
      <button
        type="button"
        className="searchable-filter-trigger"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="truncate">{label}: {selectedCustomer ? `${selectedCustomer.name} · ${selectedCustomer.phone}` : "Tất cả"}</span>
        <ChevronDown size={14} className="shrink-0" />
      </button>
      {open ? (
        <div className="searchable-filter-menu">
          <div className="searchable-filter-search">
            <Search size={13} aria-hidden="true" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setOpen(false);
              }}
              placeholder="Tìm tên, SĐT, địa chỉ..."
              aria-label="Tìm khách hàng"
            />
          </div>
          <div className="searchable-filter-options" role="listbox" aria-label={label}>
            <button
              type="button"
              className="searchable-filter-option"
              onClick={() => selectCustomer("")}
              role="option"
              aria-selected={!value}
            >
              <span className="truncate">Tất cả</span>
              {!value ? <Check size={14} /> : null}
            </button>
            {options.map((customer) => (
              <button
                key={customer.id}
                type="button"
                className="searchable-filter-option"
                onClick={() => selectCustomer(customer.id)}
                role="option"
                aria-selected={customer.id === value}
                title={`${customer.name} · ${customer.phone}`}
              >
                <span className="truncate">{customer.name} · {customer.phone}</span>
                {customer.id === value ? <Check size={14} /> : null}
              </button>
            ))}
            {isLoading ? (
              <p className="px-3 py-3 text-center text-xs text-zinc-500">Đang tải khách hàng...</p>
            ) : null}
            {!isLoading && options.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-zinc-500">Không tìm thấy khách hàng.</p>
            ) : null}
            {total > options.length ? (
              <p className="px-3 py-2 text-xs font-medium text-zinc-500">
                Hiển thị {options.length}/{total}. Nhập thêm từ khóa để tìm chính xác hơn.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
