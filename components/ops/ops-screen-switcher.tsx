"use client";

import type { FormEvent } from "react";
import dynamic from "next/dynamic";
import { defaultFilters, type PendingAction, type TabId } from "@/components/ops/app-config";
import type { AppData, Customer, Filters, ReportData, Role, Technician, WorkOrderListItem } from "@/components/ops/types";
import { DashboardScreen } from "@/components/ops/screens/dashboard-screen";
import { OrdersScreen } from "@/components/ops/screens/orders-screen";
import { TechnicianScreen } from "@/components/ops/screens/technician-screen";
import { isOpsManagerRole } from "@/lib/types";

function ScreenLoading({ label = "Đang tải màn hình..." }: { label?: string }) {
  return (
    <div className="panel flex min-h-[240px] items-center justify-center text-sm font-semibold text-zinc-500">
      {label}
    </div>
  );
}

type CustomersScreenProps = {
  customers: Customer[];
  isCreating: boolean;
  onCreate: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onView: (item: Customer) => void;
  onEdit: (item: Customer) => void;
  onDelete: (item: Customer) => void;
  onTriggerCreate: () => void;
};

type DispatchScreenProps = {
  orders: WorkOrderListItem[];
  customers: Customer[];
  technicians: Technician[];
  onView: (id: string) => void;
  onAssign: (id: string) => void;
};

type TechniciansScreenProps = {
  technicians: Technician[];
  onEdit: (item: Technician) => void;
  onDelete: (item: Technician) => void;
};

type PaymentsScreenProps = {
  orders: WorkOrderListItem[];
  onView: (id: string) => void;
  onPayment: (id: string) => void;
};

type NotificationsScreenProps = {
  notifications: AppData["notifications"];
  onOpen: (id: string) => void;
  onRead: (id: string) => Promise<void>;
};

type UsersScreenProps = {
  users: AppData["users"];
  isCreating: boolean;
  onCreate: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onEdit: (item: AppData["users"][number]) => void;
  onDelete: (item: AppData["users"][number]) => void;
  onViewAssignmentHistory: (item: AppData["users"][number]) => void;
  onResetPassword: (item: AppData["users"][number]) => void;
  onTriggerCreate: () => void;
};

const CustomersScreen = dynamic<CustomersScreenProps>(
  () => import("@/components/ops/screens/customers-screen").then((mod) => mod.CustomersScreen),
  { loading: () => <ScreenLoading label="Đang tải khách hàng..." /> },
);
const DispatchScreen = dynamic<DispatchScreenProps>(
  () => import("@/components/ops/screens/dispatch-screen").then((mod) => mod.DispatchScreen),
  { loading: () => <ScreenLoading label="Đang tải phân công..." /> },
);
const AssignmentHistoryScreen = dynamic(
  () => import("@/components/ops/screens/assignment-history-screen").then((mod) => mod.AssignmentHistoryScreen),
  { loading: () => <ScreenLoading label="Đang tải lịch sử..." /> },
);
const TechniciansScreen = dynamic<TechniciansScreenProps>(
  () => import("@/components/ops/screens/technicians-screen").then((mod) => mod.TechniciansScreen),
  { loading: () => <ScreenLoading label="Đang tải kỹ thuật viên..." /> },
);
const PaymentsScreen = dynamic<PaymentsScreenProps>(
  () => import("@/components/ops/screens/payments-screen").then((mod) => mod.PaymentsScreen),
  { loading: () => <ScreenLoading label="Đang tải thanh toán..." /> },
);
const NotificationsScreen = dynamic<NotificationsScreenProps>(
  () => import("@/components/ops/screens/notifications-screen").then((mod) => mod.NotificationsScreen),
  { loading: () => <ScreenLoading label="Đang tải thông báo..." /> },
);
const UsersScreen = dynamic<UsersScreenProps>(
  () => import("@/components/ops/screens/users-screen").then((mod) => mod.UsersScreen),
  { loading: () => <ScreenLoading label="Đang tải nhân viên..." /> },
);

type ReportsScreenProps = {
  report: ReportData | null;
  loading: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

const ReportsScreen = dynamic<ReportsScreenProps>(
  () => import("@/components/ops/screens/reports-screen").then((mod) => mod.ReportsScreen),
  { loading: () => <ScreenLoading label="Đang tải màn hình báo cáo..." /> },
);

type OpsScreenSwitcherProps = {
  section: TabId;
  role: Role;
  data: AppData;
  filters: Filters;
  reportLoading: boolean;
  pendingAction: PendingAction;
  onFilter: (filters: Filters) => void;
  onCreateOrder: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onCreateCustomer: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onCreateUser: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onOpenOrder: (id: string) => void;
  onEditOrder: (id: string) => void;
  onTechnicianStatus: (id: string, status: WorkOrderListItem["status"], checkIn?: { checkInLat?: number; checkInLng?: number }) => Promise<void>;
  onCancelOrder: (item: WorkOrderListItem) => void;
  onViewCustomer: (item: Customer) => void;
  onEditCustomer: (item: Customer) => void;
  onDeleteCustomer: (item: Customer) => void;
  onOpenDispatch: (id: string) => void;
  onAssignDispatch: (id: string) => void;
  onEditTechnician: (item: Technician) => void;
  onDeleteTechnician: (item: Technician) => void;
  onOpenPayment: (id: string) => void;
  onPaymentAction: (id: string) => void;
  onReportSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onOpenNotification: (id: string) => void;
  onReadNotification: (id: string) => Promise<void>;
  onEditUser: (item: AppData["users"][number]) => void;
  onDeleteUser: (item: AppData["users"][number]) => void;
  onViewUserAssignmentHistory: (item: AppData["users"][number]) => void;
  onResetUserPassword: (item: AppData["users"][number]) => void;
  onOpenCreateModal: (type: "user" | "customer") => void;
};

export function OpsScreenSwitcher({
  section,
  role,
  data,
  filters,
  reportLoading,
  pendingAction,
  onFilter,
  onCreateOrder,
  onCreateCustomer,
  onCreateUser,
  onOpenOrder,
  onEditOrder,
  onTechnicianStatus,
  onCancelOrder,
  onViewCustomer,
  onEditCustomer,
  onDeleteCustomer,
  onOpenDispatch,
  onAssignDispatch,
  onEditTechnician,
  onDeleteTechnician,
  onOpenPayment,
  onPaymentAction,
  onReportSubmit,
  onOpenNotification,
  onReadNotification,
  onEditUser,
  onDeleteUser,
  onViewUserAssignmentHistory,
  onResetUserPassword,
  onOpenCreateModal,
}: OpsScreenSwitcherProps) {
  if (section === "dashboard") {
    return <DashboardScreen metrics={data.metrics} orders={data.orders} onOpenOrders={(status) => onFilter({ ...defaultFilters, status })} />;
  }

  if (section === "orders") {
    return (
      <OrdersScreen
        filters={filters}
        customers={data.customers}
        technicians={data.technicians}
        orders={data.orders}
        role={role}
        canCreate={isOpsManagerRole(role)}
        isCreating={pendingAction === "create-order"}
        onFilter={onFilter}
        onCreate={onCreateOrder}
        onView={onOpenOrder}
        onEdit={onEditOrder}
        onCancel={onCancelOrder}
      />
    );
  }

  if (section === "customers") {
    return (
      <CustomersScreen
        customers={data.customers}
        isCreating={pendingAction === "create-customer"}
        onCreate={onCreateCustomer}
        onView={onViewCustomer}
        onEdit={onEditCustomer}
        onDelete={onDeleteCustomer}
        onTriggerCreate={() => onOpenCreateModal("customer")}
      />
    );
  }

  if (section === "dispatch") {
    return (
      <DispatchScreen
        orders={data.orders}
        customers={data.customers}
        technicians={data.technicians}
        onView={onOpenDispatch}
        onAssign={onAssignDispatch}
      />
    );
  }

  if (section === "technician") return <TechnicianScreen orders={data.orders} onView={onOpenOrder} onEdit={onEditOrder} onStatus={onTechnicianStatus} />;

  if (section === "assignment-history") return <AssignmentHistoryScreen />;

  if (section === "technicians") {
    return <TechniciansScreen technicians={data.technicians} onEdit={onEditTechnician} onDelete={onDeleteTechnician} />;
  }

  if (section === "payments") {
    return <PaymentsScreen orders={data.orders} onView={onOpenPayment} onPayment={onPaymentAction} />;
  }

  if (section === "reports") return <ReportsScreen report={data.report as ReportData | null} loading={reportLoading} onSubmit={onReportSubmit} />;

  if (section === "notifications") {
    return <NotificationsScreen notifications={data.notifications} onOpen={onOpenNotification} onRead={onReadNotification} />;
  }

  if (section === "users") {
    return (
      <UsersScreen
        users={data.users}
        isCreating={pendingAction === "create-user"}
        onCreate={onCreateUser}
        onEdit={onEditUser}
        onDelete={onDeleteUser}
        onViewAssignmentHistory={onViewUserAssignmentHistory}
        onResetPassword={onResetUserPassword}
        onTriggerCreate={() => onOpenCreateModal("user")}
      />
    );
  }

  return null;
}
