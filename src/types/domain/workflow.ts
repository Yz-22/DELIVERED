/**
 * DELIVERE - CORE DOMAIN CONTRACT: CUSTOM WORKFLOW ENGINE
 *
 * Establishes the domain contracts for tenant-configurable business statuses
 * while mapping strictly back to canonical financial/logistics lifecycle events.
 *
 * Core Safety Rule:
 * Custom statuses cannot execute arbitrary SQL or financial logic.
 * They map safely to application-controlled CanonicalShipmentEvents.
 */

export type CanonicalShipmentEvent =
  | 'ORDER_CREATED'
  | 'PICKUP_REQUESTED'
  | 'PICKUP_ASSIGNED'
  | 'PICKED_UP'
  | 'HUB_RECEIVED'
  | 'SORTED'
  | 'READY_FOR_DISPATCH'
  | 'DELIVERY_ASSIGNED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'DELIVERY_FAILED'
  | 'POSTPONED'
  | 'PARTIAL_DELIVERY'
  | 'RETURN_STARTED'
  | 'RETURN_AT_HUB'
  | 'RETURNED_TO_MERCHANT'
  | 'CANCELLED';

export interface TransitionRequirement {
  requireReason?: boolean;
  requireNote?: boolean;
  requireOtp?: boolean;
  requirePhoto?: boolean;
  requireSignature?: boolean;
  requireBarcodeScan?: boolean;
  requireGeofenceProximity?: boolean;
  minDistanceMeters?: number;
}

export interface TransitionActorPolicy {
  allowedRoles: string[]; // ['ADMIN', 'OPERATOR', 'DRIVER']
  requiresBranchScope?: boolean;
  requiresAssignedDriver?: boolean;
}

export interface TransitionVisibility {
  visibleToCustomer: boolean;
  visibleToMerchant: boolean;
  visibleToDriver: boolean;
}

export interface BusinessStatusDefinition {
  id: string;
  tenantId: string;
  statusCode: string; // e.g. 'CUSTOM_SORT_AMMAN'
  nameAr: string;
  nameEn: string;
  category: 'PRE_DISPATCH' | 'IN_TRANSIT' | 'TERMINAL_SUCCESS' | 'TERMINAL_FAIL' | 'RETURN';
  displayOrder: number;
  badgeColorHex: string;
  mappedCanonicalEvent: CanonicalShipmentEvent;
  
  isTerminal: boolean;
  isSystemDefault: boolean;
  isActive: boolean;
}

export interface WorkflowTransitionDefinition {
  id: string;
  tenantId: string;
  fromStatusCode: string;
  toStatusCode: string;

  requirements: TransitionRequirement;
  actorPolicy: TransitionActorPolicy;
  visibility: TransitionVisibility;

  createdAt: string;
  updatedAt: string;
}
