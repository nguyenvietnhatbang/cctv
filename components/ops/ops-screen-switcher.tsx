"use client";

import type { FormEvent } from "react";
import { defaultFilters, type PendingAction, type TabId } from "@/components/ops/app-config";
import type { AppData, Customer, Filters, ReportData, Role, Technician, WorkOrderListItem } from "@/components/ops/types";
import { DashboardScreen } from "@/components/ops/screens/dashboard-screen";
import { OrdersScreen } from "@/components/ops/screens/orders-screen";
import { CustomersScreen } from "@/components/ops/screens/customers-screen";
import { DispatchScreen } from "@/components/ops/screens/dispatch-screen";
import { TechnicianScreen } from "@/components/ops/screens/technician-screen";
import { TechniciansScreen } from "@/components/ops/screens/technicians-screen";
import { PaymentsScreen } from "@/components/ops/screens/payments-screen";
import { ReportsScreen } from "@/components/ops/screens/reports-screen";
import { NotificationsScreen } from "@/components/ops/screens/notifications-screen";
import { UsersScreen } from "@/components/ops/screens/users-screen";

type OpsScreenSwitcherProps = {
  section: TabId;
  role: Role;
  data: AppData;
  filters: Filters;
  pendingAction: PendingAction;
  onFilter: (filters: Filters) => void;
  onCreateOrder: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onCreateCustomer: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onCreateUser: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onOpenOrder: (id: string) => void;
  onEditOrder: (id: string) => void;
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
  onOpenCreateModal: (type: "user" | "customer") => void;
};

export function OpsScreenSwitcher({
  section,
  role,
  data,
  filters,
  pendingAction,
  onFilter,
  onCreateOrder,
  onCreateCustomer,
  onCreateUser,
  onOpenOrder,
  onEditOrder,
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
        canCreate={["admin", "dispatcher"].includes(role)}
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
        technicians={data.technicians}
        onView={onOpenDispatch}
        onAssign={onAssignDispatch}
      />
    );
  }

  if (section === "technician") return <TechnicianScreen orders={data.orders} onView={onOpenOrder} />;

  if (section === "technicians") {
    return <TechniciansScreen technicians={data.technicians} onEdit={onEditTechnician} onDelete={onDeleteTechnician} />;
  }

  if (section === "payments") {
    return <PaymentsScreen orders={data.orders} onView={onOpenPayment} onPayment={onPaymentAction} />;
  }

  if (section === "reports") return <ReportsScreen report={data.report as ReportData | null} onSubmit={onReportSubmit} />;

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
        onTriggerCreate={() => onOpenCreateModal("user")}
      />
    );
  }

  return null;
}
