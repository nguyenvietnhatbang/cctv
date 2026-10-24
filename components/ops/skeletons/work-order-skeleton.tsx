"use client";

export function WorkOrderTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="table-scroll orders-table-scroll animate-fade-in" aria-busy="true" aria-label="Đang tải dữ liệu">
      <table className="data-table orders-table">
        <thead>
          <tr>
            <th className="w-[120px]">Mã công việc</th>
            <th>Khách hàng</th>
            <th>Loại việc</th>
            <th>Kỹ thuật</th>
            <th>Trạng thái</th>
            <th>Thanh toán</th>
            <th>Ngày hẹn</th>
            <th>Ngày tạo</th>
            <th className="money-cell text-right">Tổng tiền</th>
            <th className="money-cell text-right">Đã thu</th>
            <th className="money-cell text-right">Còn nợ</th>
            <th className="orders-action-column" />
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, idx) => (
            <tr key={`skeleton-row-${idx}`} className="animate-pulse">
              <td data-label="Mã công việc">
                <div className="skeleton-shimmer h-4 w-20" />
              </td>
              <td data-label="Khách hàng">
                <div className="skeleton-shimmer h-4 w-36 mb-1.5" />
                <div className="skeleton-shimmer h-3 w-48 opacity-60" />
              </td>
              <td data-label="Loại việc">
                <div className="skeleton-shimmer h-5 w-20 rounded" />
              </td>
              <td data-label="Kỹ thuật">
                <div className="skeleton-shimmer h-4 w-28" />
              </td>
              <td data-label="Trạng thái">
                <div className="skeleton-shimmer h-5 w-24 rounded-full" />
              </td>
              <td data-label="Thanh toán">
                <div className="skeleton-shimmer h-5 w-20 rounded-full" />
              </td>
              <td data-label="Ngày hẹn">
                <div className="skeleton-shimmer h-4 w-24" />
              </td>
              <td data-label="Ngày tạo">
                <div className="skeleton-shimmer h-4 w-24" />
              </td>
              <td data-label="Tổng tiền" className="money-cell text-right">
                <div className="skeleton-shimmer h-4 w-20 ml-auto" />
              </td>
              <td data-label="Đã thu" className="money-cell text-right">
                <div className="skeleton-shimmer h-4 w-16 ml-auto" />
              </td>
              <td data-label="Còn nợ" className="money-cell text-right">
                <div className="skeleton-shimmer h-4 w-16 ml-auto" />
              </td>
              <td data-label="" className="orders-action-column">
                <div className="flex justify-end gap-1">
                  <div className="skeleton-shimmer h-8 w-8 rounded-md" />
                  <div className="skeleton-shimmer h-8 w-8 rounded-md" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
