"use client";

import { useState } from "react";
import { LocateFixed, MapPinned, X } from "lucide-react";
import { mapSearchUrl } from "@/components/ops/app-utils";

function getCurrentCoordinates() {
  return new Promise<{ lat: number; lng: number }>((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Trình duyệt không hỗ trợ lấy vị trí."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      }),
      () => reject(new Error("Không lấy được vị trí. Hãy cho phép quyền vị trí và mở app qua HTTPS hoặc localhost.")),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  });
}

function formatCoordinate(value: number | string | null) {
  if (value === null || value === "") return "";
  return Number(value).toFixed(7);
}

export function LocationPinField({
  address,
  initialLat = null,
  initialLng = null,
  latName = "lat",
  lngName = "lng",
  disabled = false,
}: {
  address: string;
  initialLat?: string | number | null;
  initialLng?: string | number | null;
  latName?: string;
  lngName?: string;
  disabled?: boolean;
}) {
  const [lat, setLat] = useState(() => formatCoordinate(initialLat));
  const [lng, setLng] = useState(() => formatCoordinate(initialLng));
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const hasPinnedLocation = lat !== "" && lng !== "";

  async function pinCurrentLocation() {
    setPending(true);
    setMessage(null);
    try {
      const coordinates = await getCurrentCoordinates();
      setLat(coordinates.lat.toFixed(7));
      setLng(coordinates.lng.toFixed(7));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không lấy được vị trí.");
    } finally {
      setPending(false);
    }
  }

  function clearLocation() {
    setLat("");
    setLng("");
    setMessage(null);
  }

  return (
    <div className="grid gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <input type="hidden" name={latName} value={lat} />
      <input type="hidden" name={lngName} value={lng} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase text-zinc-500">Tọa độ check-in</p>
          <p className="mt-1 text-sm font-semibold text-zinc-900">
            {hasPinnedLocation ? `${lat}, ${lng}` : "Chưa ghim tọa độ"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasPinnedLocation ? (
            <a
              className="btn-secondary h-10"
              href={mapSearchUrl({ address, lat, lng })}
              target="_blank"
              rel="noreferrer"
            >
              <MapPinned size={15} />Bản đồ
            </a>
          ) : null}
          {hasPinnedLocation ? (
            <button className="icon-button" onClick={clearLocation} type="button" aria-label="Xóa tọa độ" disabled={disabled || pending}>
              <X size={15} />
            </button>
          ) : null}
          <button className="btn-secondary h-10" onClick={pinCurrentLocation} type="button" disabled={disabled || pending}>
            {pending ? <span className="button-spinner" aria-hidden="true" /> : <LocateFixed size={15} />}
            {pending ? "Đang lấy..." : "Ghim vị trí hiện tại"}
          </button>
        </div>
      </div>
      {message ? <p className="text-sm text-amber-700">{message}</p> : null}
    </div>
  );
}
