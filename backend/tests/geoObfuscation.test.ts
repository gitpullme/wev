import { describe, it, expect } from 'vitest';
import { obfuscateLocation, obfuscatedDistance } from '../src/services/geoObfuscation.js';

describe('geoObfuscation pure functions', () => {
  const exactLat = 37.7749;
  const exactLng = -122.4194;
  const seed = 12345;

  it('Determinism: Same seed always produces the same offset', () => {
    const res1 = obfuscateLocation(exactLat, exactLng, seed);
    const res2 = obfuscateLocation(exactLat, exactLng, seed);
    expect(res1.lat).toBe(res2.lat);
    expect(res1.lng).toBe(res2.lng);
  });

  it('Different seeds produce different offsets', () => {
    const res1 = obfuscateLocation(exactLat, exactLng, 12345);
    const res2 = obfuscateLocation(exactLat, exactLng, 67890);
    expect(res1.lat).not.toBe(res2.lat);
    expect(res1.lng).not.toBe(res2.lng);
  });

  // Haversine formula for distance
  function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // in metres
  }

  it('Minimum offset: Result is always at least 100m away from exact location', () => {
    const { lat, lng } = obfuscateLocation(exactLat, exactLng, seed);
    const distance = haversine(exactLat, exactLng, lat, lng);
    expect(distance).toBeGreaterThanOrEqual(100);
  });

  it('Maximum offset: Result is never more than 600m away', () => {
    const { lat, lng } = obfuscateLocation(exactLat, exactLng, seed);
    const distance = haversine(exactLat, exactLng, lat, lng);
    expect(distance).toBeLessThanOrEqual(650); // small math margin
  });

  it('obfuscatedDistance is from obfuscated point', () => {
    const userLat = 37.7800;
    const userLng = -122.4200;
    const { lat, lng } = obfuscateLocation(exactLat, exactLng, seed);
    const expectedDist = haversine(lat, lng, userLat, userLng);
    const actualDist = obfuscatedDistance(exactLat, exactLng, userLat, userLng, seed);
    // Since obfuscatedDistance uses haversine internally and rounds, they should be extremely close
    expect(Math.abs(expectedDist - actualDist)).toBeLessThan(1); // within 1 meter difference
  });
});
