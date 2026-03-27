export type Status = 'Waiting' | 'Check In' | 'Invoice Receiving' | 'Checking' | 'Handover' | 'Check Out';

export interface Warehouse {
  id: string;
  name: string;
  location?: string;
  createdAt?: string;
}

export interface VehicleRecord {
  id: string;
  warehouseId?: string;
  seqLoading: number;
  deliveryDate: string;
  tripC: string;
  trip: string;
  sub: string;
  planLoad: string;
  driverName: string;
  driverPhone: string;
  vehicleNumber: string;
  vehicleSub: string;
  vehiclePlan: string;
  status: Status;
  checkIn?: string;
  invoiceReceiving?: string;
  checking?: string;
  handover?: string;
  checkOut?: string;
  totalTime?: string;
  percentage: number;
  remark: string;
  uploadBatchId?: string;
  uploadTimestamp?: string;
  isArchived?: boolean;
  archivedAt?: string;
  lastRevertedAt?: string;
  lastRevertedBy?: string;
  revertRemark?: string;
  queueNumber?: number;
}
