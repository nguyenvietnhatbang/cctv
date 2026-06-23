export const CHECK_IN_RADIUS_METERS = 300;

export type CheckInCoordinates = {
  checkInLat: number;
  checkInLng: number;
};

export type CheckInPayload = CheckInCoordinates & {
  updateCustomerLocation?: boolean;
  note?: string | null;
};

type CustomerCoordinates = {
  customer_lat: string | number | null;
  customer_lng: string | number | null;
};

function requestCurrentPosition(options: PositionOptions) {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

function geolocationErrorMessage(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    return "Quyền vị trí đang bị từ chối. Hãy cho phép quyền vị trí cho trang này trong cài đặt trình duyệt rồi thử lại.";
  }
  if (error.code === error.POSITION_UNAVAILABLE) {
    return "Thiết bị chưa xác định được vị trí. Hãy bật GPS/Vị trí, ra nơi thoáng hơn rồi thử lại.";
  }
  if (error.code === error.TIMEOUT) {
    return "Lấy vị trí mất quá nhiều thời gian. Hãy kiểm tra GPS và thử lại.";
  }
  return "Không lấy được vị trí hiện tại. Hãy kiểm tra quyền vị trí và GPS rồi thử lại.";
}

export async function getCurrentCheckInPosition(): Promise<CheckInCoordinates> {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    throw new Error("Trang hiện tại chưa dùng kết nối bảo mật HTTPS nên trình duyệt không cho lấy vị trí.");
  }
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    throw new Error("Trình duyệt hoặc thiết bị này không hỗ trợ lấy vị trí.");
  }

  try {
    const position = await requestCurrentPosition({
      enableHighAccuracy: true,
      timeout: 20_000,
      maximumAge: 0,
    });
    return {
      checkInLat: position.coords.latitude,
      checkInLng: position.coords.longitude,
    };
  } catch (firstError) {
    const geolocationError = firstError as GeolocationPositionError;
    if (geolocationError.code === geolocationError.PERMISSION_DENIED) {
      throw new Error(geolocationErrorMessage(geolocationError));
    }

    try {
      const fallbackPosition = await requestCurrentPosition({
        enableHighAccuracy: false,
        timeout: 15_000,
        maximumAge: 30_000,
      });
      return {
        checkInLat: fallbackPosition.coords.latitude,
        checkInLng: fallbackPosition.coords.longitude,
      };
    } catch (fallbackError) {
      throw new Error(geolocationErrorMessage(fallbackError as GeolocationPositionError));
    }
  }
}

export function distanceInMeters(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
) {
  const earthRadius = 6_371_000;
  const toRadians = (value: number) => value * Math.PI / 180;
  const latitudeDistance = toRadians(to.lat - from.lat);
  const longitudeDistance = toRadians(to.lng - from.lng);
  const fromLatitude = toRadians(from.lat);
  const toLatitude = toRadians(to.lat);
  const haversine = Math.sin(latitudeDistance / 2) ** 2
    + Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDistance / 2) ** 2;

  return earthRadius * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function checkInDistanceFromCustomer(
  customer: CustomerCoordinates,
  checkIn: CheckInCoordinates,
) {
  const customerLat = customer.customer_lat === null ? null : Number(customer.customer_lat);
  const customerLng = customer.customer_lng === null ? null : Number(customer.customer_lng);
  if (customerLat === null || customerLng === null || !Number.isFinite(customerLat) || !Number.isFinite(customerLng)) {
    return null;
  }

  return distanceInMeters(
    { lat: checkIn.checkInLat, lng: checkIn.checkInLng },
    { lat: customerLat, lng: customerLng },
  );
}

