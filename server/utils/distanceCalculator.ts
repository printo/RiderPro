/**
 * Calculate distance between two coordinates using Haversine formula
 * @param lat1 - Start latitude
 * @param lon1 - Start longitude
 * @param lat2 - End latitude
 * @param lon2 - End longitude
 * @returns Distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 100) / 100; // Round to 2 decimal places
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate distance for a shipment and update km_travelled
 * @param shipment - Shipment object with coordinates
 * @returns Updated km_travelled value
 */
export function calculateShipmentDistance(shipment: {
  start_latitude?: number;
  start_longitude?: number;
  stop_latitude?: number;
  stop_longitude?: number;
  km_travelled?: number;
}): number {
  // If all coordinates are present, calculate distance
  if (
    shipment.start_latitude !== null && shipment.start_latitude !== undefined &&
    shipment.start_longitude !== null && shipment.start_longitude !== undefined &&
    shipment.stop_latitude !== null && shipment.stop_latitude !== undefined &&
    shipment.stop_longitude !== null && shipment.stop_longitude !== undefined
  ) {
    return calculateDistance(
      shipment.start_latitude,
      shipment.start_longitude,
      shipment.stop_latitude,
      shipment.stop_longitude
    );
  }

  // Return existing distance or 0
  return shipment.km_travelled || 0;
}
