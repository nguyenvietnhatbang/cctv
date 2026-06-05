"use client";

import { FormEvent, useRef, useState } from "react";
import { CheckCircle2, Eraser } from "lucide-react";
import { money } from "@/components/ops/format";
import type { WorkOrderDetail } from "@/components/ops/types";

export function SignatureAcceptanceForm({
  detail,
  onAcceptance,
}: {
  detail: WorkOrderDetail;
  onAcceptance: (payload: { acceptanceName: string; acceptancePhone: string | null; signatureDataUrl: string }) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    if (!canvas || !rect) return { x: 0, y: 0 };
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    const next = point(event);
    context.strokeStyle = "#18181b";
    context.lineWidth = 3;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(next.x, next.y);
    setDrawing(true);
    setHasSignature(true);
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    const next = point(event);
    context.lineTo(next.x, next.y);
    context.stroke();
  }

  function clear() {
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return;
    const formData = new FormData(event.currentTarget);
    onAcceptance({
      acceptanceName: String(formData.get("acceptanceName") ?? ""),
      acceptancePhone: String(formData.get("acceptancePhone") || "") || null,
      signatureDataUrl: canvas.toDataURL("image/png"),
    });
  }

  return (
    <form onSubmit={submit} className="rounded-md border border-zinc-200 p-4">
      <h3 className="section-title">Nghiệm thu</h3>
      <div className="mt-3 rounded-md bg-zinc-50 p-3 text-sm text-zinc-700">
        <p className="font-semibold">{detail.workOrder.customer_name}</p>
        <p>{detail.workOrder.customer_address}</p>
        <p className="mt-2">Tổng tiền: <strong>{money(detail.workOrder.total_amount)}</strong></p>
      </div>
      <div className="mt-3 grid gap-2">
        <input name="acceptanceName" className="input" defaultValue={detail.workOrder.acceptance_name ?? detail.workOrder.customer_name} required />
        <input name="acceptancePhone" className="input" defaultValue={detail.workOrder.acceptance_phone ?? ""} placeholder="SĐT người ký nếu khác" />
        <canvas
          ref={canvasRef}
          width={720}
          height={260}
          className="h-40 w-full touch-none rounded-md border border-zinc-300 bg-white"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={() => setDrawing(false)}
          onPointerCancel={() => setDrawing(false)}
        />
        <label className="flex items-start gap-2 text-sm text-zinc-700">
          <input type="checkbox" className="mt-1" required />
          <span>Khách đã xem tóm tắt công việc, vật tư và tổng tiền, đồng ý nghiệm thu.</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={clear} className="btn-secondary h-10" type="button"><Eraser size={15} />Ký lại</button>
          <button className="btn-primary h-10" type="submit" disabled={!hasSignature}><CheckCircle2 size={15} />Lưu</button>
        </div>
      </div>
    </form>
  );
}
