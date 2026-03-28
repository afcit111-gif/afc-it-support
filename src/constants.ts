import { Status } from './types';

export const STATUS_FLOW: Status[] = ['Waiting', 'Check In', 'Invoice Receiving', 'Checking', 'Handover', 'Check Out'];

export const STATUS_LABELS: Record<Status, string> = {
  'Waiting': 'Waiting',
  'Check In': 'Check In',
  'Invoice Completed': 'Invoice Completed',
  'Invoice Receiving': 'Invoice Receiving',
  'Checking': 'Checking',
  'Handover': 'Handover',
  'Check Out': 'Check Out'
};

export const STATUS_ABBR: Record<Status, string> = {
  'Waiting': 'WTG',
  'Check In': 'CIN',
  'Invoice Completed': 'IVC',
  'Invoice Receiving': 'IVR',
  'Checking': 'CHK',
  'Handover': 'HOV',
  'Check Out': 'COT'
};

export const STATUS_THAI_LABELS: Record<Status, string> = {
  'Waiting': 'รอดำเนินการ',
  'Check In': 'เข้าพื้นที่',
  'Invoice Completed': 'เอกสารพร้อม',
  'Invoice Receiving': 'รับเอกสาร',
  'Checking': 'ตรวจสอบสินค้า',
  'Handover': 'ส่งมอบสินค้า',
  'Check Out': 'ออกพื้นที่'
};

export const STATUS_PERCENTAGES: Record<Status, number> = {
  'Waiting': 0,
  'Check In': 20,
  'Invoice Completed': 30,
  'Invoice Receiving': 40,
  'Checking': 60,
  'Handover': 80,
  'Check Out': 100
};

export const STATUS_COLORS: Record<Status, string> = {
  'Waiting': 'bg-blue-100 text-blue-700',
  'Check In': 'bg-red-100 text-red-700',
  'Invoice Completed': 'bg-teal-100 text-teal-700',
  'Invoice Receiving': 'bg-orange-100 text-orange-700',
  'Checking': 'bg-amber-100 text-amber-700',
  'Handover': 'bg-lime-100 text-lime-700',
  'Check Out': 'bg-emerald-100 text-emerald-700'
};

export const STATUS_SOLID_COLORS: Record<Status, string> = {
  'Waiting': 'bg-blue-600',
  'Check In': 'bg-red-600',
  'Invoice Completed': 'bg-teal-600',
  'Invoice Receiving': 'bg-orange-600',
  'Checking': 'bg-amber-600',
  'Handover': 'bg-lime-600',
  'Check Out': 'bg-emerald-600'
};

export const STATUS_HEX_COLORS: Record<Status, string> = {
  'Waiting': '#2563eb',
  'Check In': '#dc2626',
  'Invoice Completed': '#0d9488',
  'Invoice Receiving': '#ea580c',
  'Checking': '#d97706',
  'Handover': '#65a30d',
  'Check Out': '#059669'
};

export const sortPlanLoad = (a: string, b: string) => {
  if (a === 'All') return -1;
  if (b === 'All') return 1;

  const timeA = new Date(`1970-01-01T${a}:00`).getTime();
  const timeB = new Date(`1970-01-01T${b}:00`).getTime();
  
  if (isNaN(timeA)) return 1;
  if (isNaN(timeB)) return -1;

  const isAPM = timeA >= new Date('1970-01-01T12:00:00').getTime();
  const isBPM = timeB >= new Date('1970-01-01T12:00:00').getTime();

  if (isAPM && !isBPM) return -1; // PM comes before AM
  if (!isAPM && isBPM) return 1; // AM comes after PM
  return timeA - timeB; // If both PM or both AM, sort chronologically
};
