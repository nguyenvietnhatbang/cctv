"use client";

type PaymentAmountQuickActionsProps = {
  remainingAmount: number;
  disabled?: boolean;
  onSelect: (amount: string, status: "paid" | "debt") => void;
};

function decimalAmount(value: number) {
  return String(Math.round(value * 100) / 100);
}

export function PaymentAmountQuickActions({
  remainingAmount,
  disabled = false,
  onSelect,
}: PaymentAmountQuickActionsProps) {
  return (
    <div className="flex flex-wrap gap-1.5" aria-label="Chọn nhanh số tiền thanh toán">
      <button
        className="btn-secondary h-7 px-2 text-xs"
        type="button"
        onClick={() => onSelect(decimalAmount(remainingAmount), "paid")}
        disabled={disabled}
      >
        Thu đủ
      </button>
      <button
        className="btn-secondary h-7 px-2 text-xs"
        type="button"
        onClick={() => onSelect(decimalAmount(remainingAmount / 2), "debt")}
        disabled={disabled}
      >
        50%
      </button>
      <button
        className="btn-secondary h-7 px-2 text-xs"
        type="button"
        onClick={() => onSelect("0", "debt")}
        disabled={disabled}
      >
        Chưa thu
      </button>
    </div>
  );
}
