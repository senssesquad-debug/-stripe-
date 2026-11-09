import type { CameraView } from '@/lib/navigation-session';

export interface NavMapProps {
  /** route still ahead, [lng, lat] */
  geometry: Array<[number, number]>;
  /** route already travelled (drawn grey) */
  traveled: Array<[number, number]>;
  position: { lat: number; lng: number } | null;
  headingDeg: number;
  accuracyM: number | null;
  view: CameraView;
  /** the user moved, zoomed or rotated the map */
  onGesture: () => void;
  destination: [number, number];
  /** bus stops along the current transit route */
  stops?: Array<[number, number]>;
  simulated: boolean;
}
