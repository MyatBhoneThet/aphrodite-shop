export const APHRODITE_STORE_LOCATION = {
  latitude: 16.7730669,
  longitude: 96.1460789,
  label: "Aphrodite Myanmar, Lanmadaw",
} as const;

export const NEAR_DELIVERY_RADIUS_KM = 15;

export type DeliveryEstimate = {
  minDays: 2 | 3;
  maxDays: 3 | 5;
  distanceKm: number;
  township: string;
};

function radians(degrees: number) {
  return degrees * Math.PI / 180;
}

export function distanceFromStoreKm(latitude: number, longitude: number) {
  const earthRadiusKm = 6371;
  const latitudeDelta = radians(latitude - APHRODITE_STORE_LOCATION.latitude);
  const longitudeDelta = radians(longitude - APHRODITE_STORE_LOCATION.longitude);
  const originLatitude = radians(APHRODITE_STORE_LOCATION.latitude);
  const destinationLatitude = radians(latitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(originLatitude) * Math.cos(destinationLatitude)
    * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function estimateDelivery(latitude: number, longitude: number, township: string): DeliveryEstimate {
  const distanceKm = distanceFromStoreKm(latitude, longitude);
  return distanceKm <= NEAR_DELIVERY_RADIUS_KM
    ? { minDays: 2, maxDays: 3, distanceKm, township }
    : { minDays: 3, maxDays: 5, distanceKm, township };
}

export function deliveryDateRange(estimate: DeliveryEstimate, now = new Date()) {
  const start = new Date(now);
  const end = new Date(now);
  start.setDate(start.getDate() + estimate.minDays);
  end.setDate(end.getDate() + estimate.maxDays);
  const month = new Intl.DateTimeFormat("en", { month: "short" });
  const sameMonth = start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();
  return sameMonth
    ? `${month.format(start)} ${start.getDate()}–${end.getDate()}`
    : `${month.format(start)} ${start.getDate()}–${month.format(end)} ${end.getDate()}`;
}
