"use client";

import { useEffect, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { apiFetch } from "@/components/ops/api";
import { customerContactsFromFormData, removeById, replaceById } from "@/components/ops/app-utils";
import type { AppData, AppUser, AssignmentHistoryItem, Customer, ModalState, Role, Technician, WorkOrderDetail } from "@/components/ops/types";
import { AssignmentHistoryList } from "@/components/ops/assignment-history-list";
import {
  CustomerCreateModal,
  CustomerDetailModal,
  CustomerEditModal,
  TechnicianEditModal,
  UserCreateModal,
  UserEditModal,
} from "@/components/ops/entity-modals";
import { ConfirmModal, Modal, PendingButton, ValidatedForm } from "@/components/ops/ui";
import {
  DispatchAssignmentModal,
  DispatchDetailModal,
  PaymentActionModal,
  PaymentDetailModal,
  WorkOrderDetailModal,
  WorkOrderEditModal,
} from "@/components/ops/modals";

type OpsModalLayerProps = {
  modal: ModalState;
  setModal: Dispatch<SetStateAction<ModalState>>;
  detail: WorkOrderDetail | null;
  setDetail: Dispatch<SetStateAction<WorkOrderDetail | null>>;
  data: AppData;
  setData: Dispatch<SetStateAction<AppData>>;
  setError: Dispatch<SetStateAction<string | null>>;
  role: Role;
  closeOrderModal: () => void;
  closeInlineModal: () => void;
  afterMutation: () => Promise<void>;
  refreshOrderContext: () => Promise<void>;
  refreshOrders: () => Promise<AppData["orders"]>;
  refreshTechnicians: () => Promise<Technician[]>;
  submitAssignment: (event: FormEvent<HTMLFormElement>, closeAfterSubmit?: boolean) => Promise<void>;
  submitPayment: (event: FormEvent<HTMLFormElement>, closeAfterSubmit?: boolean) => Promise<void>;
  submitWorkOrderPatch: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onCreateCustomer: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onCreateUser: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

export function OpsModalLayer({
  modal,
  setModal,
  detail,
  setDetail,
  data,
  setData,
  setError,
  role,
  closeOrderModal,
  closeInlineModal,
  afterMutation,
  refreshOrderContext,
  refreshOrders,
  refreshTechnicians,
  submitAssignment,
  submitPayment,
  submitWorkOrderPatch,
  onCreateCustomer,
  onCreateUser,
}: OpsModalLayerProps) {
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [materialPendingAction, setMaterialPendingAction] = useState<{ type: "create" } | { type: "update" | "delete"; id: string } | null>(null);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [uploadingBillOrderId, setUploadingBillOrderId] = useState<string | null>(null);
  const [assignmentHistory, setAssignmentHistory] = useState<AssignmentHistoryItem[]>([]);
  const [assignmentHistoryLoading, setAssignmentHistoryLoading] = useState(false);

  useEffect(() => {
    if (modal?.type !== "user-assignment-history" || !modal.item.technician_id) return;

    let cancelled = false;
    setAssignmentHistoryLoading(true);
    setAssignmentHistory([]);
    apiFetch<{ assignmentHistory: AssignmentHistoryItem[] }>(`/api/assignment-history?technicianId=${modal.item.technician_id}`)
      .then((payload) => {
        if (!cancelled) setAssignmentHistory(payload.assignmentHistory);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Không tải được lịch sử phân công");
      })
      .finally(() => {
        if (!cancelled) setAssignmentHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [modal, setError]);

  async function runMutation(action: string, callback: () => Promise<void>) {
    setPendingAction(action);
    setError(null);
    try {
      await callback();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể xử lý yêu cầu");
    } finally {
      setPendingAction(null);
    }
  }

  async function runMaterialMutation(action: { type: "create" } | { type: "update" | "delete"; id: string }, callback: () => Promise<void>) {
    setMaterialPendingAction(action);
    setError(null);
    try {
      await callback();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể xử lý vật tư");
    } finally {
      setMaterialPendingAction(null);
    }
  }

  async function deleteResource(path: string, onDeleted?: () => Promise<void>) {
    setError(null);
    try {
      await apiFetch(path, { method: "DELETE" });
      setModal(null);
      setDetail(null);
      await onDeleted?.();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể xóa dữ liệu");
      throw reason;
    }
  }

  return (
    <>
      {detail && modal?.type === "order-detail" ? (
        <WorkOrderDetailModal
          detail={detail}
          technicians={data.technicians}
          onClose={closeOrderModal}
        />
      ) : null}

      {detail && modal?.type === "order-edit" ? (
        <WorkOrderEditModal
          detail={detail}
          role={role}
          technicians={data.technicians}
          onClose={closeOrderModal}
          pendingAction={pendingAction}
          materialPendingAction={materialPendingAction}
          deletingFileId={deletingFileId}
          onStatus={(status, checkIn) => runMutation("status", async () => { await apiFetch(`/api/work-orders/${detail.workOrder.id}/status`, { method: "POST", body: JSON.stringify({ status, ...checkIn }) }); await afterMutation(); })}
          onCancel={(event) => runMutation("cancel", async () => { event.preventDefault(); const formData = new FormData(event.currentTarget); await apiFetch(`/api/work-orders/${detail.workOrder.id}/status`, { method: "POST", body: JSON.stringify({ status: "cancelled", note: formData.get("note") }) }); await afterMutation(); })}
          onAssign={(event) => runMutation("assign", () => submitAssignment(event))}
          onUpdate={(event) => runMutation("update", () => submitWorkOrderPatch(event))}
          onMaterialCreate={(event) => runMaterialMutation({ type: "create" }, async () => { event.preventDefault(); const form = event.currentTarget; const formData = new FormData(form); await apiFetch(`/api/work-orders/${detail.workOrder.id}/materials`, { method: "POST", body: JSON.stringify({ name: formData.get("name"), quantity: formData.get("quantity"), unitPrice: formData.get("unitPrice") }) }); form.reset(); await afterMutation(); })}
          onMaterialUpdate={(material, event) => runMaterialMutation({ type: "update", id: material.id }, async () => { event.preventDefault(); const formData = new FormData(event.currentTarget); await apiFetch(`/api/work-orders/${detail.workOrder.id}/materials/${material.id}`, { method: "PATCH", body: JSON.stringify({ name: formData.get("name"), quantity: formData.get("quantity"), unitPrice: formData.get("unitPrice") }) }); await afterMutation(); })}
          onMaterialDelete={(material) => runMaterialMutation({ type: "delete", id: material.id }, async () => { await apiFetch(`/api/work-orders/${detail.workOrder.id}/materials/${material.id}`, { method: "DELETE" }); await afterMutation(); })}
          onUpload={(event) => runMutation("upload", async () => { event.preventDefault(); const form = event.currentTarget; const formData = new FormData(form); await apiFetch(`/api/work-orders/${detail.workOrder.id}/files`, { method: "POST", body: formData }); form.reset(); await afterMutation(); })}
          onFileDelete={(file) => {
            setDeletingFileId(file.id);
            return runMutation("file-delete", async () => { await apiFetch(`/api/work-orders/${detail.workOrder.id}/files/${file.id}`, { method: "DELETE" }); await afterMutation(); }).finally(() => setDeletingFileId(null));
          }}
          onPayment={(event) => runMutation("payment", () => submitPayment(event))}
          onAcceptance={(payload) => runMutation("acceptance", async () => { await apiFetch(`/api/work-orders/${detail.workOrder.id}/acceptance`, { method: "POST", body: JSON.stringify({ ...payload, agreed: true }) }); await afterMutation(); })}
        />
      ) : null}

      {detail && modal?.type === "dispatch-detail" ? (
        <DispatchDetailModal detail={detail} technicians={data.technicians} onClose={closeInlineModal} />
      ) : null}
      {detail && modal?.type === "dispatch-assignment" ? (
        <DispatchAssignmentModal
          detail={detail}
          technicians={data.technicians}
          onClose={closeInlineModal}
          onSubmit={(event) => runMutation("assign", () => submitAssignment(event, true))}
          isSubmitting={pendingAction === "assign"}
        />
      ) : null}
      {detail && modal?.type === "payment-detail" ? (
        <PaymentDetailModal detail={detail} onClose={closeInlineModal} />
      ) : null}
      {detail && modal?.type === "payment-action" ? (
        <PaymentActionModal detail={detail} onClose={closeInlineModal} onSubmit={(event) => runMutation("payment", () => submitPayment(event, true))} isSubmitting={pendingAction === "payment"} />
      ) : null}

      {modal?.type === "order-cancel" ? (
        <Modal title="Hủy phiếu" size="sm" onClose={() => setModal(null)}>
          <ValidatedForm
            onSubmit={(event) => runMutation("order-cancel", async () => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              await apiFetch(`/api/work-orders/${modal.item.id}/status`, {
                method: "POST",
                body: JSON.stringify({ status: "cancelled", note: formData.get("note") }),
              });
              setModal(null);
              await refreshOrderContext();
            })}
            aria-busy={pendingAction === "order-cancel"}
            className="grid gap-3"
          >
            <p className="text-sm leading-6 text-zinc-600">Hủy phiếu {modal.item.code}. Lý do sẽ được lưu vào lịch sử trạng thái.</p>
            <input name="note" className="input" placeholder="Lý do hủy phiếu" required disabled={pendingAction === "order-cancel"} />
            <div className="flex justify-end gap-2">
              <button className="btn-secondary h-10" onClick={() => setModal(null)} type="button" disabled={pendingAction === "order-cancel"}>Đóng</button>
              <PendingButton className="btn-danger h-10" type="submit" pending={pendingAction === "order-cancel"} pendingLabel="Đang hủy...">Hủy phiếu</PendingButton>
            </div>
          </ValidatedForm>
        </Modal>
      ) : null}

      {modal?.type === "customer-edit" ? (
        <CustomerEditModal
          item={modal.item}
          orders={data.orders}
          onClose={() => setModal(null)}
          isSubmitting={pendingAction === "customer-edit"}
          uploadingBillOrderId={uploadingBillOrderId}
          onBillUpload={(orderId, event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const formData = new FormData(form);
            const file = formData.get("file");
            if (!(file instanceof File) || file.size === 0) return;
            setUploadingBillOrderId(orderId);
            void runMutation("bill-upload", async () => {
              const uploadData = new FormData();
              uploadData.set("purpose", "bill");
              uploadData.set("file", file);
              await apiFetch(`/api/work-orders/${orderId}/files`, { method: "POST", body: uploadData });
              form.reset();
              await afterMutation();
            }).finally(() => setUploadingBillOrderId(null));
          }}
          onSubmit={(event) => runMutation("customer-edit", async () => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            const contacts = customerContactsFromFormData(formData);
            const body: Record<string, unknown> = {};
            if (formData.has("name")) body.name = formData.get("name");
            if (formData.has("phone")) body.phone = formData.get("phone");
            if (formData.has("address")) body.address = formData.get("address");
            if (formData.has("addressNote")) body.addressNote = formData.get("addressNote") || null;
            if (contacts.length) body.contacts = contacts;
            const payload = await apiFetch<{ customer: Customer }>(`/api/customers/${modal.item.id}`, {
              method: "PATCH",
              body: JSON.stringify(body),
            });
            setData((current) => ({
              ...current,
              customers: replaceById(current.customers, payload.customer),
              orders: current.orders.map((order) => order.customer_id === payload.customer.id
                ? {
                    ...order,
                    customer_name: payload.customer.name,
                    customer_phone: payload.customer.phone,
                    customer_address: payload.customer.address,
                  }
                : order),
            }));
            setModal(null);
          })}
        />
      ) : null}
      {modal?.type === "customer-create" ? (
        <CustomerCreateModal
          onClose={() => setModal(null)}
          isSubmitting={pendingAction === "customer-create"}
          onSubmit={(event) => runMutation("customer-create", async () => {
            await onCreateCustomer(event);
            setModal(null);
          })}
        />
      ) : null}
      {modal?.type === "customer-detail" ? <CustomerDetailModal item={modal.item} orders={data.orders} onClose={() => setModal(null)} /> : null}
      {modal?.type === "customer-delete" ? <ConfirmModal title="Xóa khách hàng" body={`Xóa khách hàng ${modal.item.name}? Nếu đã có phiếu, hệ thống sẽ từ chối.`} onCancel={() => setModal(null)} onConfirm={() => deleteResource(`/api/customers/${modal.item.id}`, async () => { setData((current) => ({ ...current, customers: removeById(current.customers, modal.item.id) })); })} /> : null}

      {modal?.type === "user-create" ? (
        <UserCreateModal
          onClose={() => setModal(null)}
          isSubmitting={pendingAction === "user-create"}
          onSubmit={(event) => runMutation("user-create", async () => {
            await onCreateUser(event);
            setModal(null);
          })}
        />
      ) : null}

      {modal?.type === "user-edit" ? (
        <UserEditModal
          item={modal.item}
          onClose={() => setModal(null)}
          isSubmitting={pendingAction === "user-edit"}
          onSubmit={(event) => runMutation("user-edit", async () => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            const payload = await apiFetch<{ user: AppUser }>(`/api/users/${modal.item.id}`, {
              method: "PATCH",
              body: JSON.stringify({
                fullName: formData.get("fullName"),
                email: formData.get("email") || null,
                phone: formData.get("phone") || null,
                role: formData.get("role"),
                status: formData.get("status"),
              }),
            });
            setData((current) => ({ ...current, users: replaceById(current.users, payload.user) }));
            setModal(null);
            void refreshTechnicians();
            void refreshOrders();
          })}
        />
      ) : null}
      {modal?.type === "user-delete" ? <ConfirmModal title="Ngưng nhân viên" body={`Chuyển ${modal.item.full_name} sang trạng thái ngưng hoạt động?`} confirmLabel="Ngưng" onCancel={() => setModal(null)} onConfirm={() => deleteResource(`/api/users/${modal.item.id}`, async () => { setData((current) => ({ ...current, users: replaceById(current.users, { ...modal.item, status: "inactive" }) })); void refreshTechnicians(); void refreshOrders(); })} /> : null}
      {modal?.type === "user-assignment-history" ? (
        <Modal title={`Lịch sử phân công ${modal.item.full_name}`} size="xl" onClose={() => setModal(null)}>
          {modal.item.technician_id ? (
            <AssignmentHistoryList items={assignmentHistory} loading={assignmentHistoryLoading} />
          ) : (
            <p className="text-sm text-zinc-500">Nhân viên này không phải kỹ thuật viên.</p>
          )}
        </Modal>
      ) : null}

      {modal?.type === "technician-edit" ? (
        <TechnicianEditModal
          item={modal.item}
          onClose={() => setModal(null)}
          isSubmitting={pendingAction === "technician-edit"}
          onSubmit={(event) => runMutation("technician-edit", async () => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            const payload = await apiFetch<{ technician: Technician }>(`/api/technicians/${modal.item.id}`, {
              method: "PATCH",
              body: JSON.stringify({ serviceArea: formData.get("serviceArea") || null, status: formData.get("status") }),
            });
            setData((current) => ({
              ...current,
              technicians: replaceById(current.technicians, payload.technician),
              users: current.users.map((item) => item.technician_id === payload.technician.id
                ? { ...item, service_area: payload.technician.service_area, technician_status: payload.technician.status }
                : item),
            }));
            setModal(null);
          })}
        />
      ) : null}
      {modal?.type === "technician-delete" ? <ConfirmModal title="Xóa kỹ thuật viên" body={`Xóa hồ sơ kỹ thuật viên ${modal.item.full_name}?`} onCancel={() => setModal(null)} onConfirm={() => deleteResource(`/api/technicians/${modal.item.id}`, async () => { setData((current) => ({ ...current, technicians: removeById(current.technicians, modal.item.id) })); void refreshOrders(); })} /> : null}
    </>
  );
}
