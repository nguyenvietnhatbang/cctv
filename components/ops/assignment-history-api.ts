import { apiFetch } from "@/components/ops/api";
import type { AssignmentHistoryItem } from "@/components/ops/types";

const ASSIGNMENT_HISTORY_PAGE_SIZE = 500;

type AssignmentHistoryResponse = {
  assignmentHistory: AssignmentHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export async function fetchAllAssignmentHistory(technicianId?: string) {
  const items: AssignmentHistoryItem[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(ASSIGNMENT_HISTORY_PAGE_SIZE),
    });
    if (technicianId) {
      params.set("technicianId", technicianId);
    }

    const payload = await apiFetch<AssignmentHistoryResponse>(`/api/assignment-history?${params.toString()}`);
    items.push(...payload.assignmentHistory);
    totalPages = payload.totalPages;
    page += 1;
  } while (page <= totalPages);

  return items;
}
