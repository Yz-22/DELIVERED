/**
 * DELIVERE - CORE DOMAIN CONTRACT: MULTI-LEG LOGISTICS
 *
 * Establishes the domain contracts for multi-leg transport architecture.
 *
 * Core Principle:
 * ONE SHIPMENT != ONE DRIVER.
 * A shipment may traverse multiple physical transport legs (e.g. Pickup -> Hub -> Inter-branch Transfer -> Last Mile).
 */

export type LegType =
  | 'PICKUP_LEG'
  | 'TRANSFER_LEG'
  | 'LAST_MILE_LEG'
  | 'DIRECT_LEG'
  | 'RETURN_LEG';

export type LegStatus =
  | 'PENDING_ASSIGNMENT'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'ARRIVED_AT_ORIGIN'
  | 'PICKED_UP'
  | 'ARRIVED_AT_DESTINATION'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'FAILED';

export interface TransportLegLocation {
  type: 'MERCHANT' | 'BRANCH_HUB' | 'CUSTOMER' | 'THIRD_PARTY_WAREHOUSE';
  id: string;
  name: string;
  address?: string;
  city?: string;
  governorate?: string;
  latitude?: number;
  longitude?: number;
}

export interface LegDriverEarningSnapshot {
  legId: string;
  driverId: string;
  baseEarning: number;
  bonusEarning?: number;
  currency: string;
  calculatedAt: string;
}

export interface ShipmentLeg {
  id: string;
  shipmentId: string;
  tenantId: string;
  legType: LegType;
  sequence: number; // 1, 2, 3...
  
  origin: TransportLegLocation;
  destination: TransportLegLocation;

  assignedDriverId?: string;
  vehicleId?: string;
  vehiclePlate?: string;

  status: LegStatus;

  assignedAt?: string;
  acceptedAt?: string;
  startedAt?: string;
  arrivedAt?: string;
  pickedUpAt?: string;
  completedAt?: string;

  manifestId?: string;
  driverEarningSnapshot?: LegDriverEarningSnapshot;

  createdAt: string;
  updatedAt: string;
}
