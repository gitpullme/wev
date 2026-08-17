export function obfuscateLocation(lat: number, lng: number, seed: number, radiusM: number = 500): { lat: number; lng: number } {
  // 1. Compute deterministic angle
  const angle = (seed % 360) * (Math.PI / 180);

  // 2. Compute deterministic distance (ensure min 100m)
  const baseDistance = ((seed % 100) / 100) * radiusM;
  const distance = Math.max(100, baseDistance);

  // 3. Convert polar to lat/lng offset
  const deltaLat = (distance * Math.cos(angle)) / 111320;
  const deltaLng = (distance * Math.sin(angle)) / (111320 * Math.cos(lat * (Math.PI / 180)));

  // 4. Return new coords
  return {
    lat: lat + deltaLat,
    lng: lng + deltaLng
  };
}

export function obfuscatedDistance(exactLat: number, exactLng: number, userLat: number, userLng: number, seed: number): number {
  const obfuscated = obfuscateLocation(exactLat, exactLng, seed);
  
  // Haversine
  const R = 6371e3; // metres
  const φ1 = userLat * Math.PI / 180; // φ, λ in radians
  const φ2 = obfuscated.lat * Math.PI / 180;
  const Δφ = (obfuscated.lat - userLat) * Math.PI / 180;
  const Δλ = (obfuscated.lng - userLng) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return Math.round(R * c);
}
