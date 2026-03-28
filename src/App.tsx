import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, 
  Filter, 
  Clock, 
  CheckCircle2, 
  Truck, 
  User, 
  Phone, 
  AlertCircle,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  LogIn,
  FileDown,
  FileUp,
  Plus,
  BarChart3,
  X,
  Trash2,
  Download,
  Calendar,
  History,
  Archive,
  Hash,
  Camera,
  Share2,
  Monitor,
  Maximize,
  Minimize,
  Minimize2,
  Target,
  Table,
  Activity,
  Edit2,
  Package,
  Loader2,
  RotateCcw,
  FileCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { domToPng } from 'modern-screenshot';
import { VehicleRecord, Status } from './types';
import { 
  STATUS_FLOW, 
  STATUS_LABELS, 
  STATUS_ABBR,
  STATUS_THAI_LABELS,
  STATUS_PERCENTAGES, 
  STATUS_COLORS,
  STATUS_SOLID_COLORS,
  STATUS_HEX_COLORS,
  sortPlanLoad
} from './constants';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import firebaseConfig from '../firebase-applet-config.json';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  query, 
  orderBy,
  where,
  setDoc,
  getDocs,
  getDocFromServer,
  deleteDoc,
  writeBatch,
  deleteField
} from 'firebase/firestore';

const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-stone-200 rounded-lg ${className}`} />
);

import { RecentActivityTicker } from './components/RecentActivityTicker';

export default function App() {
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [subFilter, setSubFilter] = useState('All');
  const [timeFilter, setTimeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [isFullScreenSummary, setIsFullScreenSummary] = useState(false);
  const [dashboardPlanFilter, setDashboardPlanFilter] = useState('All');
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);
  const summaryRef = useRef<HTMLDivElement>(null);
  const handOverRef = useRef<HTMLDivElement>(null);
  const dashboardScrollRef = useRef<HTMLDivElement>(null);
  const progressScrollRef = useRef<HTMLDivElement>(null);
  const [topSectionMode] = useState<'efficiency' | 'status'>('efficiency');
  const [dashboardTitleMode, setDashboardTitleMode] = useState<'title' | 'plan'>('title');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Real-time clock for dashboard
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Dashboard alternation logic
  useEffect(() => {
    if (!isFullScreenSummary) return;
    
    const interval = setInterval(() => {
      // setTopSectionMode(prev => prev === 'status' ? 'efficiency' : 'status');
      setDashboardTitleMode(prev => prev === 'title' ? 'plan' : 'title');
    }, 30000); // 30 seconds
    
    return () => clearInterval(interval);
  }, [isFullScreenSummary]);

  const latestDate = useMemo(() => {
    return vehicles.length > 0 
      ? [...new Set(vehicles.map(v => v.deliveryDate))].sort((a, b) => new Date(b as string).getTime() - new Date(a as string).getTime())[0]
      : null;
  }, [vehicles]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showArchiveHistory, setShowArchiveHistory] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<VehicleRecord | null>(null);
  const [metricsView, setMetricsView] = useState<'overview' | 'efficiency'>('overview');
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [confirm, setConfirm] = useState<{ 
    message: string, 
    onConfirm: (remark?: string) => void,
    showRemarkInput?: boolean,
    title?: string,
    icon?: React.ReactNode
  } | null>(null);
  const [confirmRemark, setConfirmRemark] = useState('');
  const [newVehicle, setNewVehicle] = useState<Partial<VehicleRecord>>({
    deliveryDate: new Date().toISOString().split('T')[0],
    status: 'Waiting',
    percentage: 0,
    sub: 'Ezie',
    trip: 'Trip 1',
    planLoad: '18:30',
    vehiclePlan: '18:30'
  });

  const getStatusIcon = (status: Status) => {
    switch (status) {
      case 'Waiting': return Clock;
      case 'Check In': return Truck;
      case 'Invoice Receiving': return FileDown;
      case 'Checking': return Search;
      case 'Handover': return Package;
      case 'Check Out': return CheckCircle2;
      default: return Activity;
    }
  };

  // Test connection to Firestore
  useEffect(() => {
    async function testConnection() {
      try {
        console.log("Testing Firestore connection to database:", firebaseConfig.firestoreDatabaseId);
        const docRef = doc(db, 'test', 'connection');
        const docSnap = await getDocFromServer(docRef);
        console.log("Firestore connection successful:", docSnap.exists());
      } catch (error) {
        console.error("Firestore connection failed:", error);
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. The client is offline.");
        }
      }
    }
    testConnection();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      // setTopSectionMode(prev => prev === 'efficiency' ? 'status' : 'efficiency');
    }, 30000); // 30 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isAuthReady || !user) {
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'vehicles'), orderBy('seqLoading', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VehicleRecord));
      
      setVehicles(data);
      setLastUpdated(new Date());
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'vehicles');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isAuthReady, user]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleStatusUpdate = async (id: string, currentStatus: Status) => {
    if (!user) return;

    const currentIndex = STATUS_FLOW.indexOf(currentStatus);
    if (currentIndex === -1 || currentIndex === STATUS_FLOW.length - 1) return;

    const nextStatus = STATUS_FLOW[currentIndex + 1];
    const timestamp = new Date().toISOString();
    const percentage = STATUS_PERCENTAGES[nextStatus];

    const vehicleRef = doc(db, 'vehicles', id);
    const updates: any = {
      status: nextStatus,
      percentage: percentage
    };

    if (nextStatus === "Check In") updates.checkIn = timestamp;
    if (nextStatus === "Checking") updates.checking = timestamp;
    if (nextStatus === "Handover") updates.handover = timestamp;
    if (nextStatus === "Invoice Receiving") {
      updates.invoiceReceiving = timestamp;
      const vehicle = vehicles.find(v => v.id === id);
      if (vehicle && !vehicle.queueNumber) {
        const samePlanVehicles = vehicles.filter(v => 
          v.deliveryDate === vehicle.deliveryDate && 
          v.planLoad === vehicle.planLoad &&
          v.queueNumber
        );
        const maxQueue = samePlanVehicles.reduce((max, v) => Math.max(max, v.queueNumber || 0), 0);
        updates.queueNumber = maxQueue + 1;
      }
    }
    if (nextStatus === "Check Out") {
      updates.checkOut = timestamp;
      const vehicle = vehicles.find(v => v.id === id);
      if (vehicle?.checkIn) {
        const start = new Date(vehicle.checkIn).getTime();
        const end = new Date(timestamp).getTime();
        const diffMs = end - start;
        const diffHrs = Math.floor(diffMs / 3600000);
        const diffMins = Math.floor((diffMs % 3600000) / 60000);
        updates.totalTime = `${diffHrs}h ${diffMins}m`;
      }
    }

    try {
      await updateDoc(vehicleRef, updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `vehicles/${id}`);
    }
  };

  const handleToggleInvoiceCompleted = async (vehicle: VehicleRecord) => {
    if (!user || vehicle.invoiceCompleted) return;
    
    try {
      const batch = writeBatch(db);
      const newValue = new Date().toISOString();
      
      // Update all vehicles in the same trip and delivery date
      const tripVehicles = vehicles.filter(v => 
        v.tripC === vehicle.tripC && 
        v.deliveryDate === vehicle.deliveryDate
      );
      
      if (tripVehicles.length === 0 || !vehicle.tripC) {
        batch.update(doc(db, 'vehicles', vehicle.id), { invoiceCompleted: newValue });
      } else {
        tripVehicles.forEach(v => {
          batch.update(doc(db, 'vehicles', v.id), { invoiceCompleted: newValue });
        });
      }
      
      await batch.commit();
      showToast(`Invoice marked as completed for trip ${vehicle.tripC || vehicle.trip}`, 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'vehicles');
      showToast('Failed to update invoice status', 'error');
    }
  };

  const handleEditDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVehicle) return;

    const originalVehicle = vehicles.find(v => v.id === editingVehicle.id);
    if (!originalVehicle) return;

    let newRemark = originalVehicle.remark || '';
    if (originalVehicle.driverName !== 'รอรถ' && originalVehicle.driverName !== editingVehicle.driverName) {
      const changeNote = `เปลี่ยนคนขับจาก: ${originalVehicle.driverName}`;
      newRemark = newRemark ? `${newRemark} | ${changeNote}` : changeNote;
    }

    try {
      await updateDoc(doc(db, 'vehicles', editingVehicle.id), {
        driverName: editingVehicle.driverName,
        driverPhone: editingVehicle.driverPhone,
        sub: editingVehicle.sub || 'Other',
        remark: newRemark
      });
      showToast('Driver details updated successfully', 'success');
      setEditingVehicle(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `vehicles/${editingVehicle.id}`);
    }
  };

  const handleStatusRevert = async (id: string, currentStatus: Status) => {
    if (!user) return;

    const currentIndex = STATUS_FLOW.indexOf(currentStatus);
    if (currentIndex <= 0) return;

    const prevStatus = STATUS_FLOW[currentIndex - 1];
    
    setConfirm({
      title: 'Confirm Revert',
      icon: <RotateCcw size={32} />,
      message: `Are you sure you want to revert status from "${STATUS_LABELS[currentStatus]}" back to "${STATUS_LABELS[prevStatus]}"? This will clear the timestamp for the current status.`,
      showRemarkInput: true,
      onConfirm: async (remark) => {
        const percentage = STATUS_PERCENTAGES[prevStatus];
        const vehicleRef = doc(db, 'vehicles', id);
        const updates: any = {
          status: prevStatus,
          percentage: percentage,
          lastRevertedAt: new Date().toISOString(),
          lastRevertedBy: user.email,
          revertRemark: remark || ''
        };

        // Clear timestamps for the status we are reverting FROM
        if (currentStatus === "Check In") updates.checkIn = null;
        if (currentStatus === "Checking") updates.checking = null;
        if (currentStatus === "Handover") updates.handover = null;
        if (currentStatus === "Invoice Receiving") {
          updates.invoiceReceiving = null;
          updates.queueNumber = deleteField();
        }
        if (currentStatus === "Check Out") {
          updates.checkOut = null;
          updates.totalTime = null;
        }

        try {
          await updateDoc(vehicleRef, updates);
          showToast(`Status reverted to ${STATUS_LABELS[prevStatus]} successfully`);
          setConfirm(null);
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `vehicles/${id}`);
        }
      }
    });
  };

  const handleArchiveAll = async () => {
    const activeVehicles = vehicles.filter(v => !v.isArchived);
    if (!user || activeVehicles.length === 0) return;

    const dates = [...new Set(activeVehicles.map(v => v.deliveryDate))].sort().reverse();
    
    setConfirm({
      title: 'Confirm Archive',
      icon: <Archive size={32} />,
      message: `Select delivery date to archive (${activeVehicles.length} total records):`,
      showRemarkInput: true,
      onConfirm: async (selectedDate?: string) => {
        const dateToArchive = selectedDate || dates[0];
        const toArchive = activeVehicles.filter(v => v.deliveryDate === dateToArchive);
        
        if (toArchive.length === 0) {
          showToast('No records found for this date');
          return;
        }

        try {
          const batch = writeBatch(db);
          const archivedAt = new Date().toISOString();
          toArchive.forEach(vehicle => {
            batch.update(doc(db, 'vehicles', vehicle.id), { 
              isArchived: true,
              archivedAt: archivedAt
            });
          });
          await batch.commit();
          showToast(`${toArchive.length} records archived successfully`);
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, 'vehicles/batch-archive');
        }
      }
    });
    setConfirmRemark(dates[0]);
  };

  const handleDeleteBatch = async (batchId: string) => {
    if (!user) return;
    const batchVehicles = vehicles.filter(v => v.uploadBatchId === batchId);
    if (batchVehicles.length === 0) return;

    setConfirm({
      title: 'Confirm Delete',
      icon: <Trash2 size={32} />,
      message: `Are you sure you want to delete this entire upload batch (${batchVehicles.length} vehicles)?`,
      onConfirm: async () => {
        try {
          const batch = writeBatch(db);
          batchVehicles.forEach(vehicle => {
            batch.delete(doc(db, 'vehicles', vehicle.id));
          });
          await batch.commit();
          showToast('Batch deleted successfully');
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, 'vehicles');
        }
      }
    });
  };

  const uploadBatches = useMemo(() => {
    const batches: { id: string, timestamp: string, count: number, date: string }[] = [];
    const seen = new Set<string>();

    vehicles.forEach(v => {
      if (v.uploadBatchId && !seen.has(v.uploadBatchId)) {
        seen.add(v.uploadBatchId);
        const count = vehicles.filter(veh => veh.uploadBatchId === v.uploadBatchId).length;
        batches.push({
          id: v.uploadBatchId,
          timestamp: v.uploadTimestamp || '',
          count,
          date: v.deliveryDate
        });
      }
    });

    return batches.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [vehicles]);

  const handleExportExcel = (data: VehicleRecord[], filename: string) => {
    if (!Array.isArray(data)) {
      console.error('Export failed: data is not an array', data);
      showToast('Export failed: Invalid data format', 'error');
      return;
    }

    try {
      const dataToExport = data.map(v => {
        const qNum = vehicleQueues[v.id];
        
        return {
          'SEQ': v.seqLoading,
          'DELIVERY_DATE': v.deliveryDate,
          'TRIP_NUBMER': v.trip,
          'SUB': v.sub,
          'PLANLOAD': v.planLoad,
          'QUEUE': qNum || '-',
          'DRIVER_NAME': v.driverName,
          'PHONE_NUMBER': v.driverPhone,
          'VEHICLE_NUMBER': v.vehicleNumber,
          'STATUS': STATUS_LABELS[v.status],
          'REMARK': v.remark || '-',
          'CHECK-IN': v.checkIn ? new Date(v.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '-',
          'INVOICE_COMPLETED': v.invoiceCompleted ? new Date(v.invoiceCompleted).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '-',
          'INVOICE_RECEIVING': v.invoiceReceiving ? new Date(v.invoiceReceiving).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '-',
          'CHECKING': v.checking ? new Date(v.checking).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '-',
          'HANDOVER': v.handover ? new Date(v.handover).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '-',
          'CHECK_OUT': v.checkOut ? new Date(v.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '-',
          'TURNAROUND_TIME': v.totalTime || '-',
          'ARCHIVED_AT': v.archivedAt ? new Date(v.archivedAt).toLocaleString() : '-'
        };
      });

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Vehicles");
      XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
      showToast('Excel exported successfully!', 'success');
    } catch (error) {
      console.error('Export error:', error);
      showToast('Export failed: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error');
    }
  };

  const handleCaptureSummary = async (type: 'all' | 'handover' = 'all') => {
    const targetRef = type === 'all' ? summaryRef : handOverRef;
    if (!targetRef.current) return;
    
    try {
      showToast(`Capturing ${type === 'all' ? 'Full Report' : 'Table Only'}...`, 'success');
      
      // Find scrollable container if it's the "all" capture
      const scrollContainer = type === 'all' ? targetRef.current.querySelector('.overflow-y-auto') as HTMLElement : null;
      const originalMaxHeight = scrollContainer?.style.maxHeight;
      const originalOverflow = scrollContainer?.style.overflow;
      const originalHeight = scrollContainer?.style.height;

      // Also handle the target's parent to ensure no clipping
      const parent = targetRef.current.parentElement;
      const originalParentMaxHeight = parent?.style.maxHeight;
      const originalParentOverflow = parent?.style.overflow;
      const originalParentHeight = parent?.style.height;

      if (scrollContainer) {
        scrollContainer.style.height = 'auto';
        scrollContainer.style.maxHeight = 'none';
        scrollContainer.style.overflow = 'visible';
        
        // Also ensure the target itself doesn't clip
        targetRef.current.style.height = 'auto';
        targetRef.current.style.maxHeight = 'none';
        targetRef.current.style.overflow = 'visible';

        // Expand parent if it exists
        if (parent) {
          parent.style.maxHeight = 'none';
          parent.style.height = 'auto';
          parent.style.overflow = 'visible';
        }
      }

      const dataUrl = await domToPng(targetRef.current, {
        backgroundColor: '#ffffff',
        scale: 2, // Higher quality
        quality: 1,
      });

      if (scrollContainer) {
        scrollContainer.style.height = originalHeight || '';
        scrollContainer.style.maxHeight = originalMaxHeight || '';
        scrollContainer.style.overflow = originalOverflow || '';
        
        // Restore target styles
        targetRef.current.style.height = '';
        targetRef.current.style.maxHeight = '';
        targetRef.current.style.overflow = '';

        // Restore parent styles
        if (parent) {
          parent.style.maxHeight = originalParentMaxHeight || '';
          parent.style.height = originalParentHeight || '';
          parent.style.overflow = originalParentOverflow || '';
        }
      }
      
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${type === 'all' ? 'Daily_Operations_Full_Report' : 'Operations_Table'}_${new Date().toISOString().split('T')[0]}.png`;
      link.click();
      showToast(`${type === 'all' ? 'Full Report' : 'Table'} captured successfully!`, 'success');
    } catch (error) {
      console.error('Capture error:', error);
      showToast('Failed to capture', 'error');
    }
  };

  const formatExcelTime = (value: any) => {
    if (value === undefined || value === null || value === '') return '';
    
    if (typeof value === 'number') {
      const totalSeconds = Math.round(value * 24 * 3600);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
    
    const str = String(value).trim();
    const timeMatch = str.match(/(\d{1,2}):(\d{1,2})/);
    if (timeMatch) {
      return `${timeMatch[1].padStart(2, '0')}:${timeMatch[2].padStart(2, '0')}`;
    }
    
    return str;
  };

  const formatExcelDate = (value: any) => {
    if (value === undefined || value === null || value === '') return new Date().toISOString().split('T')[0];
    
    if (typeof value === 'number') {
      const date = new Date(Math.round((value - 25569) * 86400 * 1000));
      return date.toISOString().split('T')[0];
    }
    
    const str = String(value).trim();
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    
    return str;
  };

  const cleanInput = (val: string) => (val || '').toString().replace(/[\s-]/g, '');

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws) as any[];
      if (!Array.isArray(data)) {
        showToast('Import failed: Invalid Excel format', 'error');
        return;
      }

      const batchId = `batch-${Date.now()}`;
      const uploadTimestamp = new Date().toISOString();

      const newRecords: VehicleRecord[] = data.map((row, index) => {
        const planLoad = formatExcelTime(row['PLANLOAD'] || row['Plan Load'] || row['Plan:รถเข้ามาโหลด']);
        const vehiclePlan = formatExcelTime(row['Vehicle Plan'] || row['PLANLOAD'] || row['Plan Load'] || row['Plan:รถเข้ามาโหลด']);
        const seq = row['SEQ'] || row['Seq'] || row['Seq Loading'];
        
        return {
          id: `v-${Date.now()}-${index}`,
          seqLoading: typeof seq === 'number' ? seq : (parseInt(seq) || index + 1),
          deliveryDate: formatExcelDate(row['DELIVERY_DATE'] || row['Delivery Date']), // formatExcelDate defaults to today if empty
          tripC: row['TRIP_C'] || row['Trip C'] || '',
          trip: row['TRIP_NUMBER'] || row['TRIP_NUBMER'] || row['Trip'] || '',
          sub: row['SUB'] || row['Sub'] || '',
          planLoad: planLoad,
          driverName: row['DRIVER_NAME'] || row['Driver name2'] || row['Driver Name'] || '',
          driverPhone: cleanInput(row['PHONE_NUMBER'] || row['Phone number'] || row['Driver Phone'] || ''),
          vehicleNumber: cleanInput(row['VEHICLE_NUMBER'] || row['Vehicle Number'] || ''),
          vehicleSub: row['Vehicle Sub'] || '',
          vehiclePlan: vehiclePlan,
          status: 'Waiting',
          percentage: 0,
          remark: row['Remark'] || '',
          uploadBatchId: batchId,
          uploadTimestamp: uploadTimestamp
        };
      });

      // Batch write to Firestore
      try {
        const batch = writeBatch(db);
        for (const record of newRecords) {
          batch.set(doc(db, 'vehicles', record.id), record);
        }
        await batch.commit();
        showToast(`Imported ${newRecords.length} vehicles successfully!`);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'vehicles/batch-import');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleAddManual = async () => {
    if (!newVehicle.vehicleNumber || !newVehicle.driverName) {
      showToast('Please fill in required fields', 'error');
      return;
    }

    const id = `v-${Date.now()}`;
    const record: VehicleRecord = {
      id,
      seqLoading: vehicles.length + 1,
      deliveryDate: newVehicle.deliveryDate || '',
      tripC: newVehicle.tripC || '',
      trip: newVehicle.trip || '',
      sub: newVehicle.sub || '',
      planLoad: newVehicle.planLoad || '',
      driverName: newVehicle.driverName || '',
      driverPhone: cleanInput(newVehicle.driverPhone || ''),
      vehicleNumber: cleanInput(newVehicle.vehicleNumber || ''),
      vehicleSub: newVehicle.vehicleSub || '',
      vehiclePlan: newVehicle.vehiclePlan || newVehicle.planLoad || '',
      status: 'Waiting',
      percentage: 0,
      remark: newVehicle.remark || ''
    };

    try {
      await setDoc(doc(db, 'vehicles', id), record);
      setShowAddModal(false);
      setNewVehicle({
        deliveryDate: new Date().toISOString().split('T')[0],
        status: 'Waiting',
        percentage: 0,
        sub: 'Ezie',
        trip: 'Trip 1',
        planLoad: '18:30',
        vehiclePlan: '18:30'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `vehicles/${id}`);
    }
  };

  const handleDeleteVehicle = async (id: string) => {
    setConfirm({
      title: 'Confirm Delete',
      icon: <Trash2 size={32} />,
      message: 'Are you sure you want to delete this record?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'vehicles', id));
          showToast('Record deleted successfully');
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, 'vehicles');
        }
      }
    });
  };

  const downloadTemplate = () => {
    const template = [{
      'SEQ': 1,
      'TRIP_C': 'C1',
      'TRIP_NUMBER': 'Trip 1',
      'DRIVER_NAME': 'John Doe',
      'PHONE_NUMBER': '0812345678',
      'VEHICLE_NUMBER': 'กข1234',
      'SUB': 'Sub 1',
      'PLANLOAD': '18:30',
      'DRIVER_NAME / PHONE_NUMBER': 'John Doe / 0812345678',
      'VEHICLE_NUMBER / SUB / PLANLOAD': 'กข1234 / Sub 1 / 18:30'
    }];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Vehicle_Plan_Template.xlsx");
  };

  const vehicleQueues = useMemo(() => {
    const queue: Record<string, number> = {};
    
    // 1. Use stored queue numbers first
    vehicles.forEach(v => {
      if (v.queueNumber) queue[v.id] = v.queueNumber;
    });

    // 2. Fallback calculation for vehicles that have invoiceReceiving but no stored queueNumber
    const needsQueue = vehicles.filter(v => v.invoiceReceiving && !v.queueNumber);
    if (needsQueue.length > 0) {
      const groups: Record<string, typeof needsQueue> = {};
      needsQueue.forEach(v => {
        const key = `${v.deliveryDate}_${v.planLoad}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(v);
      });

      Object.entries(groups).forEach(([key, group]) => {
        const [date, plan] = key.split('_');
        const existingInGroup = vehicles.filter(v => 
          v.deliveryDate === date && 
          v.planLoad === plan && 
          v.queueNumber
        );
        let maxQ = existingInGroup.reduce((max, v) => Math.max(max, v.queueNumber || 0), 0);
        
        group.sort((a, b) => new Date(a.invoiceReceiving!).getTime() - new Date(b.invoiceReceiving!).getTime());
        group.forEach(v => {
          maxQ++;
          queue[v.id] = maxQ;
        });
      });
    }

    return queue;
  }, [vehicles]);

  // Adaptive Dashboard: Auto-scroll and rotate rounds
  useEffect(() => {
    if (!isFullScreenSummary) {
      setCurrentRoundIndex(0);
      return;
    }

    const latestDate = vehicles.length > 0 
      ? [...new Set(vehicles.map(v => v.deliveryDate))].sort((a, b) => new Date(b as string).getTime() - new Date(a as string).getTime())[0]
      : null;
    
    if (!latestDate) return;

    const latestVehicles = vehicles.filter(v => v.deliveryDate === latestDate);
    const activePlanGroups = [...new Set(latestVehicles.map(v => v.planLoad))].sort(sortPlanLoad);

    if (dashboardPlanFilter !== 'All') {
      const idx = activePlanGroups.indexOf(dashboardPlanFilter);
      if (idx !== -1) {
        setCurrentRoundIndex(idx);
      }
      // Continue to scroll logic below, but don't change round index at the end
    }

    if (activePlanGroups.length === 0) return;

    let scrollInterval: NodeJS.Timeout;
    let nextRoundTimeout: NodeJS.Timeout;
    let initialDelay: NodeJS.Timeout;

    const startAutoScroll = () => {
      const container = dashboardScrollRef.current;
      if (!container) return;

      container.scrollTop = 0;

      let animationFrameId: number;
      let lastTime = performance.now();
      const pixelsPerSecond = 50; 
      let currentTranslateY = 0;

      const scroll = (currentTime: number) => {
        if (!container) return;

        const deltaTime = (currentTime - lastTime) / 1000;
        lastTime = currentTime;

        const content = container.querySelector('.scroll-content') as HTMLElement;
        if (!content) return;
        const maxScroll = content.scrollHeight - container.clientHeight + 100;
        
        if (currentTranslateY >= maxScroll) {
          // Wait at bottom before switching
          nextRoundTimeout = setTimeout(() => {
            if (dashboardPlanFilter === 'All' && activePlanGroups.length > 1) {
              setCurrentRoundIndex((prev) => (prev + 1) % activePlanGroups.length);
            } else {
              startAutoScroll();
            }
          }, 5000);
          return;
        }

        currentTranslateY += pixelsPerSecond * deltaTime;
        content.style.transform = `translateY(-${currentTranslateY}px)`;
        animationFrameId = requestAnimationFrame(scroll);
      };

      initialDelay = setTimeout(() => {
        lastTime = performance.now();
        animationFrameId = requestAnimationFrame(scroll);
      }, 3000);

      return () => {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
      };
    };

    const cleanup = startAutoScroll();

    return () => {
      if (cleanup) cleanup();
      clearTimeout(nextRoundTimeout);
      clearTimeout(initialDelay);
    };
  }, [isFullScreenSummary, dashboardPlanFilter, currentRoundIndex]);

  // Progress Auto-scroll
  useEffect(() => {
    if (!isFullScreenSummary) return;

    let scrollInterval: NodeJS.Timeout;
    let pauseTimeout: NodeJS.Timeout;
    let startTimeout: NodeJS.Timeout;

    const startAutoScroll = () => {
      const container = document.getElementById('progress-scroll-container');
      if (!container) {
        startTimeout = setTimeout(startAutoScroll, 100);
        return;
      }

      // Reset scroll
      container.scrollTop = 0;

      let animationFrameId: number;
      let lastTime = performance.now();
      const pixelsPerSecond = 30; // Slightly slower for readability

      const scroll = (currentTime: number) => {
        if (!container) return;

        const deltaTime = (currentTime - lastTime) / 1000;
        lastTime = currentTime;

        const isAtBottom = Math.ceil(container.scrollTop + container.clientHeight) >= container.scrollHeight - 1;

        if (isAtBottom) {
          pauseTimeout = setTimeout(startAutoScroll, 5000);
          return;
        }

        container.scrollTop += pixelsPerSecond * deltaTime;
        animationFrameId = requestAnimationFrame(scroll);
      };

      pauseTimeout = setTimeout(() => {
        lastTime = performance.now();
        animationFrameId = requestAnimationFrame(scroll);
      }, 3000);

      return () => {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
      };
    };

    let cleanup: (() => void) | undefined;
    startTimeout = setTimeout(() => {
      cleanup = startAutoScroll();
    }, 500);

    return () => {
      clearTimeout(startTimeout);
      clearTimeout(pauseTimeout);
      if (cleanup) cleanup();
    };
  }, [isFullScreenSummary]);

  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdated(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      if (v.isArchived) return false;
      const matchesSearch = 
        v.driverName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v.tripC && v.tripC.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesSub = subFilter === 'All' || v.sub === subFilter;
      const matchesTime = timeFilter === 'All' || v.planLoad === timeFilter;
      const matchesStatus = statusFilter === 'All' 
        ? true 
        : statusFilter === 'Invoice Completed' 
          ? !!v.invoiceCompleted 
          : v.status === statusFilter;
      const matchesDate = dateFilter === 'All' || v.deliveryDate === dateFilter;

      return matchesSearch && matchesSub && matchesTime && matchesStatus && matchesDate;
    }).sort((a, b) => {
      const dateA = new Date(a.deliveryDate).getTime();
      const dateB = new Date(b.deliveryDate).getTime();
      if (dateB !== dateA) return dateB - dateA;
      return (b.planLoad || '').localeCompare(a.planLoad || '');
    });
  }, [vehicles, searchTerm, subFilter, timeFilter, statusFilter, dateFilter]);

  const archivedVehicles = useMemo(() => {
    return vehicles.filter(v => v.isArchived).sort((a, b) => {
      const dateA = new Date(a.archivedAt || 0).getTime();
      const dateB = new Date(b.archivedAt || 0).getTime();
      return dateB - dateA;
    });
  }, [vehicles]);

  const subOptions = useMemo(() => {
    const subs = new Set(vehicles.map(v => (v.sub || '').trim()).filter(Boolean));
    subs.add('Other');
    return ['All', ...Array.from(subs)].sort();
  }, [vehicles]);

  const dateOptions = useMemo(() => {
    const dates = new Set(vehicles.map(v => (v.deliveryDate || '').trim()).filter(Boolean));
    return ['All', ...Array.from(dates)].sort((a, b) => (b as string).localeCompare(a as string));
  }, [vehicles]);

  const timeOptions = useMemo(() => {
    const times = new Set(vehicles.map(v => (v.planLoad || '').trim()).filter(Boolean));
    return ['All', ...Array.from(times)].sort(sortPlanLoad);
  }, [vehicles]);

  const formatEfficiency = (mins: number) => {
    if (mins >= 60) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${h}h ${m}m`;
    }
    return `${mins}m`;
  };

  const getTurnaroundTime = (checkIn?: string | null, checkOut?: string | null) => {
    if (!checkIn) return null;
    const start = new Date(checkIn).getTime();
    const end = checkOut ? new Date(checkOut).getTime() : Date.now();
    return Math.floor((end - start) / 60000);
  };

  const getEfficiencyData = (v: VehicleRecord) => {
    const { checkIn, invoiceReceiving, checking, handover, checkOut } = v;
    
    if (!checkIn || !invoiceReceiving || !checking || !handover || !checkOut) {
      return { status: 'missing' };
    }

    const tCIN = new Date(checkIn).getTime();
    const tIVR = new Date(invoiceReceiving).getTime();
    const tCHK = new Date(checking).getTime();
    const tHOV = new Date(handover).getTime();
    const tCOT = new Date(checkOut).getTime();

    if (tCIN > tIVR || tIVR > tCHK || tCHK > tHOV || tHOV > tCOT) {
      return { status: 'error' };
    }

    const waiting = (tIVR - tCIN) / 60000;
    const processing = (tCHK - tIVR) / 60000;
    const checkingTime = (tHOV - tCHK) / 60000;
    const postHandover = (tCOT - tHOV) / 60000;
    const tat = (tCOT - tCIN) / 60000;

    if (tat === 0) {
      return { status: 'zero_tat' };
    }

    const active = processing + checkingTime + (postHandover <= 60 ? postHandover : 0);
    const efficiency = Math.round((active / tat) * 100);

    let insight = 'Normal';
    if (postHandover > 120) {
      insight = 'Overnight Delay';
    } else if (waiting > 0.3 * tat) {
      insight = 'High Waiting';
    } else if (efficiency >= 80) {
      insight = 'Good Performance';
    }

    let color = '';
    let dotColor = '';
    let emoji = '';
    if (efficiency >= 80) {
      color = 'text-emerald-500';
      dotColor = 'bg-emerald-500';
      emoji = '🟢';
    } else if (efficiency >= 60) {
      color = 'text-amber-500';
      dotColor = 'bg-amber-500';
      emoji = '🟡';
    } else {
      color = 'text-red-500';
      dotColor = 'bg-red-500';
      emoji = '🔴';
    }

    return {
      status: 'valid',
      efficiency,
      active: Math.round(active),
      tat: Math.round(tat),
      insight,
      color,
      dotColor,
      emoji
    };
  };

  const getDelayStatus = (deliveryDate: string, planLoad: string, checkIn?: string | null) => {
    if (!planLoad || !deliveryDate || !planLoad.includes(':') || !deliveryDate.includes('-')) return null;
    
    const [year, month, day] = deliveryDate.split('-').map(Number);
    const [hours, minutes] = planLoad.split(':').map(Number);
    
    if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hours) || isNaN(minutes)) return null;

    const planTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
    
    const compareTime = checkIn ? new Date(checkIn) : new Date();
    
    const diffMs = compareTime.getTime() - planTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins > 0) {
      return { status: 'Delay', mins: diffMins };
    } else {
      return { status: 'On Time', mins: Math.abs(diffMins) };
    }
  };

  const efficiencyMetrics = useMemo(() => {
    const completedVehicles = vehicles.filter(v => v.status === 'Check Out' && v.checkIn && v.checkOut);
    const avgTime = completedVehicles.length > 0 
      ? completedVehicles.reduce((acc, v) => {
          const start = new Date(v.checkIn!).getTime();
          const end = new Date(v.checkOut!).getTime();
          return acc + (end - start);
        }, 0) / completedVehicles.length / 60000
      : 0;
    
    const delayedCount = vehicles.filter(v => {
      const status = getDelayStatus(v.deliveryDate, v.planLoad, v.checkIn);
      return status?.status === 'Delay';
    }).length;

    const completionRate = vehicles.length > 0
      ? Math.round((vehicles.filter(v => v.status === 'Check Out').length / vehicles.length) * 100)
      : 0;

    return { avgTime, delayedCount, completionRate };
  }, [vehicles]);

  const stats = useMemo(() => {
    const total = filteredVehicles.length;
    const statusCounts = STATUS_FLOW.reduce((acc, status) => {
      acc[status] = filteredVehicles.filter(v => v.status === status).length;
      return acc;
    }, {} as Record<Status, number>);

    const getPercentage = (count: number) => total > 0 ? Math.round((count / total) * 100) : 0;

    return {
      total,
      statusCounts,
      list: [
        {
          label: 'TOTAL',
          subLabel: 'ทั้งหมด',
          value: total,
          icon: Activity,
          color: 'text-white',
          bg: 'bg-slate-900',
          solidBg: 'bg-slate-900',
          percentage: 100
        },
        ...STATUS_FLOW.map(status => ({
          label: STATUS_LABELS[status],
          subLabel: STATUS_THAI_LABELS[status],
          value: statusCounts[status],
          icon: getStatusIcon(status),
          color: 'text-white',
          bg: STATUS_COLORS[status].split(' ')[0],
          solidBg: STATUS_SOLID_COLORS[status],
          percentage: getPercentage(statusCounts[status])
        }))
      ]
    };
  }, [filteredVehicles]);

  const activities = useMemo(() => {
    return vehicles
      .filter(v => v.lastStatusUpdate)
      .map(v => ({
        vehicleNumber: v.vehicleNumber,
        driverName: v.driverName,
        trip: v.tripC || '',
        sub: v.sub || '',
        status: v.status,
        time: new Date(v.lastStatusUpdate!).getTime(),
        timeString: v.lastStatusUpdate!
      }))
      .sort((a, b) => b.time - a.time);
  }, [vehicles]);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center"
        >
          <div className="w-16 h-16 bg-indigo-100 hexagon flex items-center justify-center mx-auto mb-6">
            <Truck className="w-8 h-8 text-indigo-600" />
          </div>
          <div className="mb-6">
            <img 
              src="https://lh3.googleusercontent.com/d/1Cd3dVNnqheL1GtcAgomBcyylCRw7s8x-" 
              alt="Logo" 
              className="h-12 mx-auto object-contain"
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
            />
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-slate-900 leading-none mb-2">
            VEHICLE<span className="text-indigo-600">TRACKER</span>
          </h1>
          <p className="text-stone-500 mb-8">Please login with your Google account to access the tracker.</p>
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white border border-stone-300 text-stone-700 px-6 py-3 rounded-xl font-medium hover:bg-stone-50 transition-colors shadow-sm"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
            Login with Google
          </button>
          <div className="mt-8 pt-6 border-t border-stone-100 text-center">
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em]">
              VehicleTracker • © 2026 AFC IT Support
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
      {/* Top Activity Ticker */}
      <RecentActivityTicker activities={activities} />

      {/* Main Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 backdrop-blur-md bg-white/80">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            {/* Logo & Search */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-8 flex-1">
              <div className="flex items-center gap-4">
                <div className="bg-indigo-600 w-14 h-14 hexagon flex items-center justify-center text-white shadow-xl shadow-indigo-100 shrink-0">
                  <Truck size={28} className="animate-pulse" />
                </div>
                <div>
                  <img 
                    src="https://lh3.googleusercontent.com/d/1Cd3dVNnqheL1GtcAgomBcyylCRw7s8x-" 
                    alt="Logo" 
                    className="h-8 mb-2 object-contain"
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                  />
                  <h1 className="text-2xl font-black tracking-tighter text-slate-900 leading-none">VEHICLE<span className="text-indigo-600">TRACKER</span></h1>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1.5">Logistics Intelligence</p>
                </div>
              </div>

              {/* Status Summary in Header */}
              <div className="hidden lg:flex items-center gap-2 xl:gap-4 ml-4 flex-wrap xl:flex-nowrap">
                {stats.list.map((s, i) => (
                  <div key={i} className="flex items-center gap-1.5 xl:gap-2.5 group shrink-0">
                    <div className={`w-8 h-8 xl:w-9 xl:h-9 rounded-xl ${s.bg} flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform shrink-0`}>
                      <s.icon size={16} className={s.label === 'TOTAL' ? 'text-white' : STATUS_COLORS[STATUS_FLOW[i - 1]]?.split(' ')[1]} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-base xl:text-lg font-black text-slate-900 leading-none">{s.value}</span>
                      <div className="flex flex-col mt-1">
                        <span className="text-[8px] xl:text-[9px] font-bold text-slate-400 leading-none mb-0.5">({s.percentage}%)</span>
                        <span className="text-[7px] xl:text-[8px] font-black text-slate-500 uppercase tracking-wider leading-none truncate">{s.label}</span>
                        <span className="text-[7px] font-bold text-slate-300 leading-none mt-0.5 truncate">{s.subLabel}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* User & Global Actions */}
            <div className="flex items-center gap-4 self-end lg:self-auto">
              <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl">
                <button
                  onClick={() => setShowSummary(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-white hover:shadow-sm transition-all text-slate-700 whitespace-nowrap"
                >
                  <BarChart3 size={16} className="text-indigo-600" />
                  Summary
                </button>
              </div>

              <div className="h-10 w-px bg-slate-200 mx-1 hidden lg:block" />

              {user ? (
                <div className="flex items-center gap-4 pl-2">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-bold text-slate-900 leading-none">{user.displayName}</p>
                    <p className="text-[10px] text-slate-400 font-medium mt-1.5">{user.email}</p>
                  </div>
                  <div className="relative">
                    <div className="w-11 h-11 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-indigo-100 border-2 border-white">
                      {user.displayName?.charAt(0)}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full" />
                  </div>
                  <button
                    onClick={() => signOut(auth)}
                    className="w-11 h-11 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all border border-transparent hover:border-red-100"
                    title="Sign Out"
                  >
                    <LogOut size={20} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
                  className="flex items-center gap-3 bg-indigo-600 text-white px-6 py-3 rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
                >
                  <LogIn size={18} />
                  Sign In
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Controls Bar */}
      <div className="bg-slate-50 border-b border-slate-200 sticky top-[89px] z-20">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[140px]">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <select
                  value={subFilter}
                  onChange={(e) => setSubFilter(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-9 pr-4 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none transition-all"
                >
                  {subOptions.map(opt => <option key={opt} value={opt}>{opt === 'All' ? 'All Subs' : opt}</option>)}
                </select>
              </div>

              <div className="relative min-w-[140px]">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-9 pr-4 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none transition-all"
                >
                  {dateOptions.map(opt => <option key={opt} value={opt}>{opt === 'All' ? 'All Dates' : opt}</option>)}
                </select>
              </div>

              <div className="relative min-w-[140px]">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <select
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-9 pr-4 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none transition-all"
                >
                  {timeOptions.map(opt => <option key={opt} value={opt}>{opt === 'All' ? 'All Times' : opt}</option>)}
                </select>
              </div>

              <div className="relative min-w-[140px]">
                <Activity className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-9 pr-4 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none transition-all"
                >
                  <option value="All">All Status</option>
                  <option value="Invoice Completed">Invoice Completed</option>
                  {STATUS_FLOW.map(status => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
                </select>
              </div>

              <div className="relative flex-1 lg:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-9 pr-4 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
              >
                <Plus size={16} />
                Add Vehicle
              </button>
              
              <div className="h-6 w-px bg-slate-200 mx-1" />

              <div className="flex items-center gap-2">
                <label className="cursor-pointer flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all">
                  <FileUp size={16} className="text-slate-400" />
                  Import
                  <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleImportExcel} />
                </label>
                <button
                  onClick={() => handleExportExcel(filteredVehicles, 'Vehicle_Export')}
                  className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all"
                >
                  <FileDown size={16} className="text-slate-400" />
                  Export
                </button>
                <button
                  onClick={() => setShowHistory(true)}
                  className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all"
                >
                  <History size={16} className="text-slate-400" />
                  History
                </button>
                <button
                  onClick={() => setShowArchiveHistory(true)}
                  className="flex items-center gap-2 bg-white border border-slate-200 text-red-500 px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-red-50 hover:border-red-100 transition-all"
                >
                  <Archive size={16} />
                  Archive
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* Modals */}
      <AnimatePresence>
        {editingVehicle && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
            >
              <div className="px-8 py-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-600 w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                    <Edit2 size={20} />
                  </div>
                  <h2 className="text-xl font-bold text-stone-900">Edit Driver Details</h2>
                </div>
                <button 
                  onClick={() => setEditingVehicle(null)}
                  className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleEditDriver} className="p-8">
                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Driver Name *</label>
                    <input
                      type="text"
                      required
                      value={editingVehicle.driverName}
                      onChange={e => setEditingVehicle({...editingVehicle, driverName: e.target.value})}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="Driver full name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Driver Phone</label>
                    <input
                      type="tel"
                      value={editingVehicle.driverPhone}
                      onChange={e => setEditingVehicle({...editingVehicle, driverPhone: e.target.value})}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="081xxxxxxx"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Sub</label>
                    <select
                      value={editingVehicle.sub || 'Other'}
                      onChange={e => setEditingVehicle({...editingVehicle, sub: e.target.value})}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    >
                      {subOptions.filter(opt => opt !== 'All').map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-8 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingVehicle(null)}
                    className="px-6 py-3 text-stone-500 font-bold hover:bg-stone-50 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-3 bg-stone-900 text-white font-bold rounded-xl hover:bg-stone-800 transition-colors shadow-lg shadow-stone-200"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden"
            >
              <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50">
                <div className="flex items-center gap-3">
                  <div className="bg-stone-900 p-2 rounded-lg text-white">
                    <Plus size={20} />
                  </div>
                  <h2 className="text-xl font-bold">Add New Vehicle Plan</h2>
                </div>
                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-stone-200 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">Delivery Date</label>
                  <input 
                    type="date" 
                    className="w-full p-3 bg-stone-100 border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
                    value={newVehicle.deliveryDate}
                    onChange={e => setNewVehicle({...newVehicle, deliveryDate: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">Vehicle Number *</label>
                  <input 
                    type="text" 
                    placeholder="e.g. กข1234"
                    className="w-full p-3 bg-stone-100 border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
                    value={newVehicle.vehicleNumber || ''}
                    onChange={e => setNewVehicle({...newVehicle, vehicleNumber: cleanInput(e.target.value)})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">Driver Name *</label>
                  <input 
                    type="text" 
                    placeholder="Driver full name"
                    className="w-full p-3 bg-stone-100 border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
                    value={newVehicle.driverName || ''}
                    onChange={e => setNewVehicle({...newVehicle, driverName: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">Driver Phone</label>
                  <input 
                    type="text" 
                    placeholder="081xxxxxxx"
                    className="w-full p-3 bg-stone-100 border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
                    value={newVehicle.driverPhone || ''}
                    onChange={e => setNewVehicle({...newVehicle, driverPhone: cleanInput(e.target.value)})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">Sub</label>
                  <select 
                    className="w-full p-3 bg-stone-100 border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
                    value={newVehicle.sub}
                    onChange={e => setNewVehicle({...newVehicle, sub: e.target.value})}
                  >
                    {subOptions.filter(opt => opt !== 'All').map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">Plan Load Time</label>
                  <select 
                    className="w-full p-3 bg-stone-100 border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
                    value={newVehicle.planLoad}
                    onChange={e => setNewVehicle({...newVehicle, planLoad: e.target.value, vehiclePlan: e.target.value})}
                  >
                    {timeOptions.filter(opt => opt !== 'All').map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-6 bg-stone-50 border-t border-stone-100 flex items-center justify-between">
                <button 
                  onClick={downloadTemplate}
                  className="flex items-center gap-2 text-indigo-600 font-bold hover:underline"
                >
                  <Download size={18} />
                  Download Excel Template
                </button>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowAddModal(false)}
                    className="px-6 py-3 rounded-xl font-bold text-stone-500 hover:bg-stone-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleAddManual}
                    className="bg-stone-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-stone-800 transition-all shadow-lg shadow-stone-200"
                  >
                    Add Vehicle
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showSummary && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-2xl max-w-4xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]"
            >
              <div ref={summaryRef} className="bg-white flex flex-col flex-1 overflow-hidden">
                {/* Header */}
                <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                  <div className="flex items-center gap-5">
                    <div className="bg-indigo-600 w-14 h-14 rounded-2xl text-white flex items-center justify-center shadow-xl shadow-indigo-100">
                      <BarChart3 size={28} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-slate-900 tracking-tight">Daily Operations Report</h2>
                      {(() => {
                        const latestDate = vehicles.length > 0 
                          ? [...new Set(vehicles.map(v => v.deliveryDate))].sort((a, b) => new Date(b as string).getTime() - new Date(a as string).getTime())[0]
                          : 'No Data';
                        return (
                          <div className="flex items-center gap-4 mt-1">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                              <Calendar size={14} className="text-indigo-500" />
                              {latestDate}
                            </p>
                            <div className="h-3 w-px bg-slate-200" />
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                              <Clock size={14} className="text-indigo-500" />
                              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setIsFullScreenSummary(true)} 
                      className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl text-xs font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 active:scale-95"
                    >
                      <Monitor size={16} />
                      Dashboard Mode
                    </button>
                    <button 
                      onClick={() => setShowSummary(false)} 
                      className="w-12 h-12 flex items-center justify-center hover:bg-slate-100 rounded-2xl transition-all text-slate-400 hover:text-slate-900 border border-slate-200"
                    >
                      <X size={24} />
                    </button>
                  </div>
                </div>

                <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar flex-1">
                  {(() => {
                    const latestDate = vehicles.length > 0 
                      ? [...new Set(vehicles.map(v => v.deliveryDate))].sort((a, b) => new Date(b as string).getTime() - new Date(a as string).getTime())[0]
                      : null;
                    
                    const latestVehicles = latestDate 
                      ? vehicles.filter(v => v.deliveryDate === latestDate)
                      : [];
                    
                    const total = latestVehicles.length;
                    const completed = latestVehicles.filter(v => v.status === 'Check Out').length;
                    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

                    return (
                      <>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                          {/* Left: Progress & Efficiency */}
                          <div className="space-y-8">
                            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex items-center gap-8">
                              <div className="relative w-32 h-32 shrink-0">
                                <svg className="w-full h-full" viewBox="0 0 36 36">
                                  <path
                                    className="text-slate-100 stroke-current"
                                    strokeWidth="4"
                                    fill="none"
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                  />
                                  <motion.path
                                    initial={{ strokeDasharray: "0, 100" }}
                                    animate={{ strokeDasharray: `${completionRate}, 100` }}
                                    transition={{ duration: 1.5, ease: "easeOut" }}
                                    className="text-indigo-600 stroke-current"
                                    strokeWidth="4"
                                    strokeLinecap="round"
                                    fill="none"
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                  />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                  <span className="text-2xl font-black text-slate-900">{completionRate}%</span>
                                </div>
                              </div>
                              <div>
                                <h3 className="text-lg font-black text-slate-900 mb-1">Overall Progress</h3>
                                <p className="text-sm text-slate-500 font-medium">Daily completion rate for all scheduled vehicles.</p>
                                <div className="flex items-center gap-4 mt-4">
                                  <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-indigo-600" />
                                    <span className="text-xs font-bold text-slate-600">Done</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-slate-200" />
                                    <span className="text-xs font-bold text-slate-600">Remaining</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-xl shadow-slate-200">
                              <div className="flex items-center justify-between mb-8">
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Efficiency Metrics</h3>
                                <BarChart3 size={16} className="text-indigo-400" />
                              </div>
                              {(() => {
                                const completedVehicles = latestVehicles.filter(v => v.status === 'Check Out');
                                const avgTime = completedVehicles.length > 0 
                                  ? (completedVehicles.reduce((acc, v) => {
                                      const [h, m] = (v.totalTime || '0h 0m').split(' ').map(s => parseInt(s));
                                      return acc + (h * 60 + (m || 0));
                                    }, 0) / completedVehicles.length).toFixed(0)
                                  : 0;
                                
                                return (
                                  <div className="grid grid-cols-2 gap-8">
                                    <div>
                                      <p className="text-4xl font-black text-white">{formatEfficiency(parseInt(avgTime as string))}</p>
                                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Avg. Processing / Vehicle</p>
                                    </div>
                                    <div className="space-y-4">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-400">On Time</span>
                                        <span className="text-xs font-black text-emerald-400">
                                          {latestVehicles.filter(v => v.status !== 'Waiting' && getDelayStatus(v.deliveryDate, v.planLoad, v.checkIn)?.status === 'On Time').length}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-400">Delayed</span>
                                        <span className="text-xs font-black text-red-400">
                                          {latestVehicles.filter(v => v.status !== 'Waiting' && getDelayStatus(v.deliveryDate, v.planLoad, v.checkIn)?.status === 'Delay').length}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>

                          {/* Right: Status Breakdown */}
                          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">Hand Over Progress by Status</h3>
                            <div className="space-y-5">
                              {STATUS_FLOW.map(status => {
                                const count = latestVehicles.filter(v => v.status === status).length;
                                const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
                                return (
                                  <div key={status} className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-lg ${STATUS_SOLID_COLORS[status]} text-white flex items-center justify-center shadow-sm`}>
                                          {status === 'Waiting' ? <Clock size={14} /> : 
                                           status === 'Check In' ? <Truck size={14} /> :
                                           status === 'Invoice Receiving' ? <FileDown size={14} /> :
                                           status === 'Checking' ? <Search size={14} /> :
                                           status === 'Handover' ? <Package size={14} /> : <CheckCircle2 size={14} />}
                                        </div>
                                        <div className="flex flex-col">
                                          <span className="text-xs font-black text-slate-700 leading-tight">{STATUS_LABELS[status]}</span>
                                          <span className="text-[10px] font-bold text-slate-500 mt-0.5">{STATUS_THAI_LABELS[status]}</span>
                                        </div>
                                      </div>
                                      <span className="text-xs font-black text-slate-900">{count} <span className="text-slate-400 font-bold ml-1">({percentage}%)</span></span>
                                    </div>
                                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                      <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${percentage}%` }}
                                        className={`h-full ${STATUS_SOLID_COLORS[status]}`} 
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Bottom: Handover Progress Table */}
                        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden" ref={handOverRef}>
                          <div className="flex items-center justify-between mb-8">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hand Over Progress by Plan</h3>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-emerald-500" />
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Completed</span>
                            </div>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                  <th className="pb-4 px-2">Plan Load</th>
                                  {STATUS_FLOW.map(status => (
                                    <th key={status} className="pb-4 px-2 text-center">{STATUS_LABELS[status]}</th>
                                  ))}
                                  <th className="pb-4 px-2 text-center bg-slate-50 rounded-t-xl">Total</th>
                                  <th className="pb-4 px-2 text-right">Progress</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {(() => {
                                  const planGroups = [...new Set(latestVehicles.map(v => v.planLoad))].sort(sortPlanLoad);
                                  const totalsByStatus = STATUS_FLOW.reduce((acc, s) => ({ ...acc, [s]: 0 }), {} as Record<Status, number>);
                                  let grandTotal = 0;

                                  const rows = planGroups.map(plan => {
                                    const roundVehicles = latestVehicles.filter(v => v.planLoad === plan);
                                    const rowTotal = roundVehicles.length;
                                    grandTotal += rowTotal;
                                    
                                    const statusCounts = STATUS_FLOW.reduce((acc, s) => {
                                      const count = roundVehicles.filter(v => v.status === s).length;
                                      acc[s] = count;
                                      totalsByStatus[s] += count;
                                      return acc;
                                    }, {} as Record<Status, number>);

                                    const completed = roundVehicles.filter(v => v.status === 'Check Out').length;
                                    const percentage = rowTotal > 0 ? (completed / rowTotal) * 100 : 0;

                                    return (
                                      <tr key={plan} className="group hover:bg-slate-50/50 transition-colors">
                                        <td className="py-4 px-2 font-black text-slate-900">{plan}</td>
                                        {STATUS_FLOW.map(status => (
                                          <td key={status} className={`py-4 px-2 text-center font-bold ${status === 'Check Out' ? 'text-emerald-600' : 'text-slate-500'}`}>
                                            {statusCounts[status] || '-'}
                                          </td>
                                        ))}
                                        <td className="py-4 px-2 text-center font-black text-slate-900 bg-slate-50/50">{rowTotal}</td>
                                        <td className="py-4 px-2 text-right">
                                          <div className="flex items-center justify-end gap-3">
                                            <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                              <div className={`h-full ${percentage === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${percentage}%` }} />
                                            </div>
                                            <span className={`text-[10px] font-black w-8 text-right ${percentage === 100 ? 'text-emerald-600' : 'text-slate-900'}`}>{percentage.toFixed(0)}%</span>
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  });

                                  return (
                                    <>
                                      {rows}
                                      <tr className="bg-slate-900 text-white font-black">
                                        <td className="py-4 px-4 rounded-l-2xl">TOTAL</td>
                                        {STATUS_FLOW.map(status => (
                                          <td key={status} className="py-4 px-2 text-center">{totalsByStatus[status]}</td>
                                        ))}
                                        <td className="py-4 px-2 text-center text-indigo-400">{grandTotal}</td>
                                        <td className="py-4 px-4 text-right rounded-r-2xl">
                                          {grandTotal > 0 ? ((totalsByStatus['Check Out'] / grandTotal) * 100).toFixed(0) : 0}%
                                        </td>
                                      </tr>
                                    </>
                                  );
                                })()}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="p-8 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-center shrink-0">
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                  <button 
                    onClick={() => handleCaptureSummary('all')}
                    className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95 text-sm"
                  >
                    <Camera size={18} />
                    Capture: Full Report
                  </button>
                  <button 
                    onClick={() => handleCaptureSummary('handover')}
                    className="flex items-center justify-center gap-2 bg-slate-900 text-white px-8 py-4 rounded-2xl font-black hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 active:scale-95 text-sm"
                  >
                    <Table size={18} />
                    Capture: Table Only
                  </button>
                </div>
                <button 
                  onClick={() => setShowSummary(false)}
                  className="w-full sm:w-auto bg-white border border-slate-200 text-slate-600 px-10 py-4 rounded-2xl font-black hover:bg-slate-50 transition-all active:scale-95 text-sm"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showHistory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden"
            >
              <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50">
                <div className="flex items-center gap-3">
                  <div className="bg-stone-900 p-2 rounded-lg text-white">
                    <RotateCcw size={20} />
                  </div>
                  <h2 className="text-xl font-bold">Upload History</h2>
                </div>
                <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-stone-200 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-6 max-h-[60vh] overflow-y-auto">
                {uploadBatches.length === 0 ? (
                  <div className="py-12 text-center text-stone-400">
                    <FileUp size={48} className="mx-auto mb-4 opacity-20" />
                    <p>No upload history found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {uploadBatches.map(batch => (
                      <div key={batch.id} className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl border border-stone-100 group">
                        <div className="flex items-center gap-4">
                          <div className="bg-white p-3 rounded-xl shadow-sm">
                            <FileUp size={20} className="text-indigo-600" />
                          </div>
                          <div>
                            <p className="font-bold text-stone-900">
                              Imported {batch.count} vehicles
                            </p>
                            <p className="text-xs text-stone-500">
                              {new Date(batch.timestamp).toLocaleString()} • Plan Date: {batch.date}
                            </p>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleDeleteBatch(batch.id)}
                          className="p-3 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                          title="Delete this batch"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-6 bg-stone-50 border-t border-stone-100 flex justify-end">
                <button 
                  onClick={() => setShowHistory(false)}
                  className="bg-stone-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-stone-800 transition-all"
                >
                  Close History
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
          {loading ? (
            [...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                <div className="flex justify-between items-start">
                  <Skeleton className="w-16 h-16 rounded-2xl" />
                  <Skeleton className="w-24 h-6 rounded-lg" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="w-3/4 h-6" />
                  <Skeleton className="w-1/2 h-4" />
                </div>
                <Skeleton className="w-full h-2 rounded-full" />
                <div className="flex justify-between">
                  <Skeleton className="w-20 h-4" />
                  <Skeleton className="w-20 h-4" />
                </div>
                <Skeleton className="w-full h-12 rounded-xl" />
              </div>
            ))
          ) : filteredVehicles.length === 0 ? (
            <div className="col-span-full py-32 flex flex-col items-center justify-center text-center">
              <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6 text-slate-300">
                <Search size={48} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">No vehicles found</h3>
              <p className="text-slate-500 max-w-sm">
                We couldn't find any vehicles matching your current filters or search terms.
              </p>
              <button 
                onClick={() => {
                  setSearchTerm('');
                  setSubFilter('All');
                  setDateFilter('All');
                  setTimeFilter('All');
                  setStatusFilter('All');
                }}
                className="mt-6 text-indigo-600 font-bold hover:underline"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filteredVehicles.map((vehicle) => (
                <motion.div
                  key={vehicle.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="group bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all duration-300 overflow-hidden flex flex-col"
                >
                  {/* Card Header */}
                  <div className="p-6 pb-4 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-16 h-16 rounded-2xl ${STATUS_SOLID_COLORS[vehicle.status]} flex flex-col items-center justify-center text-white shadow-lg transition-colors duration-500`}>
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-70 leading-none mb-1">{vehicle.planLoad}</span>
                        <span className="text-2xl font-black leading-none">{vehicleQueues[vehicle.id] || '-'}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vehicle</span>
                        </div>
                        <h3 className="text-xl font-black text-slate-900 tracking-tight leading-none">{vehicle.vehicleNumber}</h3>
                        {(() => {
                          const tatMins = getTurnaroundTime(vehicle.checkIn, vehicle.checkOut);
                          if (tatMins !== null) {
                            return (
                              <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">TAT</span>
                                <span className={`text-xs font-black ${vehicle.checkOut ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {formatEfficiency(tatMins)}
                                </span>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <button 
                        onClick={() => handleStatusRevert(vehicle.id, vehicle.status)}
                        className={`p-2 rounded-xl transition-all ${vehicle.status === 'Waiting' ? 'opacity-0 pointer-events-none' : vehicle.revertRemark ? 'text-red-500 hover:bg-red-50' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`}
                        title="Revert Status"
                      >
                        <RotateCcw size={18} className="rotate-180" />
                      </button>
                      {vehicle.revertRemark && (
                        <span className="text-[8px] font-black text-red-500 bg-red-50 px-1.5 py-0.5 rounded-md max-w-[80px] truncate" title={vehicle.revertRemark}>
                          {vehicle.revertRemark}
                        </span>
                      )}
                      <button 
                        onClick={() => setEditingVehicle(vehicle)}
                        className={`p-2 rounded-xl transition-all ${vehicle.status === 'Check Out' ? 'opacity-0 pointer-events-none' : vehicle.revertRemark ? 'text-red-500 hover:bg-red-50' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                        title="Edit Details"
                      >
                        <Edit2 size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Driver & Trip Info */}
                  <div className="px-6 py-4 bg-slate-50/50 border-y border-slate-100 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex flex-col min-w-0">
                        <p className="text-base font-black text-slate-900 leading-tight break-words flex items-center gap-1.5">
                          <User size={12} className="text-indigo-500 shrink-0" />
                          {vehicle.driverName}
                        </p>
                        <p className="text-sm font-bold text-slate-500 flex items-center gap-1.5 mt-1">
                          <Phone size={12} className="text-indigo-500 shrink-0" />
                          {vehicle.driverPhone}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">TRIP NUMBER</p>
                        <p className="text-3xl font-black text-indigo-600 leading-none">{vehicle.tripC}</p>
                      </div>
                    </div>
                    
                    <div className="pt-3 border-t border-slate-100/50 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SUB</span>
                        <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-md text-center border border-indigo-100/50 shadow-sm">
                          {vehicle.sub}
                        </span>
                      </div>
                      <div className="text-right min-w-0">
                        <p className="text-[11px] font-bold text-slate-500 break-all leading-normal">
                          {vehicle.trip}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Progress & Status */}
                  <div className="p-6 flex-1 flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Status</span>
                        <div className={`inline-flex flex-col px-3 py-1.5 rounded-xl border ${STATUS_COLORS[vehicle.status]} border-current/10 shadow-sm`}>
                          <span className="text-xs font-black uppercase tracking-widest leading-tight">
                            {STATUS_LABELS[vehicle.status]}
                          </span>
                          <span className="text-[10px] font-bold mt-0.5 opacity-80 uppercase tracking-wider">
                            {STATUS_THAI_LABELS[vehicle.status]}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Progress</span>
                        <span className="text-lg font-black text-slate-900">{vehicle.percentage}%</span>
                      </div>
                    </div>

                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden mb-6 shadow-inner">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${vehicle.percentage}%` }}
                        className={`h-full rounded-full shadow-lg ${
                          vehicle.percentage === 100 ? 'bg-emerald-500' : 
                          vehicle.percentage > 0 ? 'bg-indigo-500' : 'bg-slate-300'
                        }`}
                      />
                    </div>

                    {/* Timestamps Grid */}
                    <div className="grid grid-cols-3 gap-y-4 gap-x-4 mb-8">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">CIN</span>
                        <span className="text-xs font-black text-slate-700">{vehicle.checkIn ? new Date(vehicle.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '--:--'}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">IVC</span>
                        <span className="text-xs font-black text-slate-700">{vehicle.invoiceCompleted ? new Date(vehicle.invoiceCompleted).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '--:--'}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">IVR</span>
                        <span className="text-xs font-black text-slate-700">{vehicle.invoiceReceiving ? new Date(vehicle.invoiceReceiving).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '--:--'}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">CHK</span>
                        <span className="text-xs font-black text-slate-700">{vehicle.checking ? new Date(vehicle.checking).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '--:--'}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">HOV</span>
                        <span className="text-xs font-black text-slate-700">{vehicle.handover ? new Date(vehicle.handover).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '--:--'}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">COT</span>
                        <span className="text-xs font-black text-slate-700">{vehicle.checkOut ? new Date(vehicle.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '--:--'}</span>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="mt-auto flex flex-col gap-2">
                      <button 
                        onClick={() => handleToggleInvoiceCompleted(vehicle)}
                        disabled={!!vehicle.invoiceCompleted}
                        className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-black transition-all border ${
                          vehicle.invoiceCompleted 
                            ? 'bg-emerald-500 text-white border-emerald-600 cursor-not-allowed shadow-sm' 
                            : 'bg-red-500 text-white border-red-600 hover:bg-red-600 shadow-sm hover:shadow-md active:scale-[0.98]'
                        }`}
                      >
                        <FileCheck size={18} />
                        <span>{vehicle.invoiceCompleted ? 'Invoice Completed' : 'Mark: Invoice Completed'}</span>
                      </button>

                      {vehicle.status !== 'Check Out' ? (
                        <button 
                          onClick={() => handleStatusUpdate(vehicle.id, vehicle.status)}
                          className="w-full group flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl text-sm font-black transition-all shadow-lg shadow-indigo-100 active:scale-[0.98]"
                        >
                          <span>Next: {STATUS_FLOW[STATUS_FLOW.indexOf(vehicle.status) + 1]}</span>
                          <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                      ) : (
                        <div className="w-full flex items-center justify-center gap-2 bg-emerald-50 text-emerald-600 py-4 rounded-2xl text-sm font-black border border-emerald-100">
                          <CheckCircle2 size={18} />
                          <span>Operation Completed</span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </main>


      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-bold text-sm ${
              toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Archive History Modal */}
      <AnimatePresence>
        {showArchiveHistory && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden"
            >
              <div className="p-6 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between bg-stone-50/50 gap-4">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-100 p-2 rounded-xl text-indigo-600">
                    <History size={20} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-stone-900">Archive History</h3>
                    <p className="text-xs text-stone-500">View previously archived records</p>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">

                  <div className="flex items-center gap-2">
                    {archivedVehicles.length > 0 && (
                      <>
                        <button
                          onClick={() => {
                            const dates = [...new Set(archivedVehicles.map(v => v.deliveryDate))].sort().reverse();
                            setConfirm({
                              title: 'Confirm Restore',
                              icon: <Archive size={32} />,
                              message: `Select delivery date to restore records:`,
                              showRemarkInput: true,
                              onConfirm: async (selectedDate?: string) => {
                                const dateToRestore = selectedDate || dates[0];
                                const toRestore = archivedVehicles.filter(v => v.deliveryDate === dateToRestore);
                                
                                if (toRestore.length === 0) {
                                  showToast('No records found for this date');
                                  return;
                                }

                                try {
                                  const batch = writeBatch(db);
                                  toRestore.forEach(vehicle => {
                                    batch.update(doc(db, 'vehicles', vehicle.id), { 
                                      isArchived: false,
                                      archivedAt: null
                                    });
                                  });
                                  await batch.commit();
                                  showToast(`${toRestore.length} records restored successfully`);
                                } catch (error) {
                                  handleFirestoreError(error, OperationType.UPDATE, 'vehicles/batch-restore');
                                }
                              }
                            });
                            setConfirmRemark(dates[0]);
                          }}
                          className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-2 rounded-xl text-[11px] font-bold hover:bg-indigo-700 transition-colors"
                        >
                          <Archive size={14} /> Restore by Date
                        </button>
                        <button
                          onClick={() => handleExportExcel(archivedVehicles, 'Archived_Vehicles_Export')}
                          className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-2 rounded-xl text-[11px] font-bold hover:bg-emerald-700 transition-colors"
                        >
                          <Download size={14} />
                          Export ({archivedVehicles.length})
                        </button>
                      </>
                    )}
                    <button 
                      onClick={() => setShowArchiveHistory(false)}
                      className="p-2 hover:bg-stone-200 rounded-full transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {archivedVehicles.length === 0 ? (
                  <div className="text-center py-20">
                    <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4 text-stone-400">
                      <History size={32} />
                    </div>
                    <p className="text-stone-500 font-medium">No archived records found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {archivedVehicles.map((v) => (
                      <div key={v.id} className="bg-stone-50 rounded-2xl p-4 border border-stone-100 flex items-center justify-between group hover:border-indigo-200 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="bg-white w-12 h-12 hexagon shadow-sm border border-stone-100 flex items-center justify-center shrink-0">
                            <Truck className="text-stone-400" size={20} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-stone-900">{v.vehicleNumber}</span>
                              <span className="text-sm px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md font-bold uppercase tracking-wider">{v.sub}</span>
                              {vehicleQueues[v.id] && (
                                <span className={`text-[10px] px-2 py-0.5 rounded-md font-black text-white ${STATUS_SOLID_COLORS[v.status]}`}>
                                  Queue: {v.planLoad}/{vehicleQueues[v.id]}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-sm text-stone-500">
                              <span className="flex items-center gap-1"><User size={12} /> {v.driverName}</span>
                              <span className="flex items-center gap-1"><Calendar size={12} /> {v.deliveryDate}</span>
                              {v.tripC && <span className="flex items-center gap-1 text-indigo-500 font-bold"><Hash size={10} /> {v.tripC}</span>}
                              <span className="flex items-center gap-1"><Clock size={12} /> Archived: {new Date(v.archivedAt || '').toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={async () => {
                              try {
                                await updateDoc(doc(db, 'vehicles', v.id), { isArchived: false, archivedAt: null });
                                showToast('Record restored successfully');
                              } catch (error) {
                                handleFirestoreError(error, OperationType.UPDATE, `vehicles/${v.id}`);
                              }
                            }}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                            title="Restore"
                          >
                            <RotateCcw size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center"
            >
              <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6 text-amber-600">
                {confirm.icon || <AlertCircle size={32} />}
              </div>
              <h3 className="text-xl font-bold text-stone-900 mb-2">{confirm.title || 'Confirmation'}</h3>
              <p className="text-stone-500 mb-6 text-sm leading-relaxed whitespace-pre-line">{confirm.message}</p>
              
              {confirm.showRemarkInput && (
                <div className="mb-6 text-left">
                  <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">
                    {confirm.title === 'Confirm Archive' ? 'Select Date' : 'Remark / Reason for Revert'}
                  </label>
                  {confirm.title === 'Confirm Archive' ? (
                    <select
                      value={confirmRemark}
                      onChange={(e) => setConfirmRemark(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    >
                      {[...new Set(vehicles.filter(v => !v.isArchived).map(v => v.deliveryDate))].sort().reverse().map(date => (
                        <option key={date} value={date}>{date}</option>
                      ))}
                    </select>
                  ) : (
                    <textarea
                      value={confirmRemark}
                      onChange={(e) => setConfirmRemark(e.target.value)}
                      placeholder="Enter reason for reverting status..."
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-amber-500 outline-none transition-all min-h-[80px] resize-none"
                      autoFocus
                    />
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => {
                    setConfirm(null);
                    setConfirmRemark('');
                  }}
                  className="px-6 py-3 bg-stone-100 text-stone-600 rounded-2xl font-bold hover:bg-stone-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    confirm.onConfirm(confirmRemark);
                    setConfirm(null);
                    setConfirmRemark('');
                  }}
                  className="px-6 py-3 bg-amber-600 text-white rounded-2xl font-bold hover:bg-amber-700 transition-colors shadow-lg shadow-amber-100"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Full Screen Dashboard Summary */}
      <AnimatePresence>
        {isFullScreenSummary && (() => {
          const latestDate = vehicles.length > 0 
            ? [...new Set(vehicles.map(v => v.deliveryDate))].sort((a, b) => new Date(b as string).getTime() - new Date(a as string).getTime())[0]
            : null;
          
          const latestVehicles = latestDate 
            ? vehicles.filter(v => v.deliveryDate === latestDate)
            : [];

          const recentActivities = latestVehicles.flatMap(v => {
            const activities = [];
            if (v.checkIn) activities.push({ vehicleNumber: v.vehicleNumber, driverName: v.driverName, trip: v.tripC || '', sub: v.sub || '', status: 'Check In' as Status, time: new Date(v.checkIn).getTime(), timeString: v.checkIn });
            if (v.invoiceCompleted) activities.push({ vehicleNumber: v.vehicleNumber, driverName: v.driverName, trip: v.tripC || '', sub: v.sub || '', status: 'Invoice Completed' as Status, time: new Date(v.invoiceCompleted).getTime(), timeString: v.invoiceCompleted });
            if (v.invoiceReceiving) activities.push({ vehicleNumber: v.vehicleNumber, driverName: v.driverName, trip: v.tripC || '', sub: v.sub || '', status: 'Invoice Receiving' as Status, time: new Date(v.invoiceReceiving).getTime(), timeString: v.invoiceReceiving });
            if (v.checking) activities.push({ vehicleNumber: v.vehicleNumber, driverName: v.driverName, trip: v.tripC || '', sub: v.sub || '', status: 'Checking' as Status, time: new Date(v.checking).getTime(), timeString: v.checking });
            if (v.handover) activities.push({ vehicleNumber: v.vehicleNumber, driverName: v.driverName, trip: v.tripC || '', sub: v.sub || '', status: 'Handover' as Status, time: new Date(v.handover).getTime(), timeString: v.handover });
            if (v.checkOut) activities.push({ vehicleNumber: v.vehicleNumber, driverName: v.driverName, trip: v.tripC || '', sub: v.sub || '', status: 'Check Out' as Status, time: new Date(v.checkOut).getTime(), timeString: v.checkOut });
            return activities;
          }).sort((a, b) => b.time - a.time).slice(0, 30);

          const total = latestVehicles.length;
          const completed = latestVehicles.filter(v => v.status === 'Check Out').length;
          const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-slate-50 text-slate-900 h-screen overflow-hidden font-sans flex flex-col"
            >
              {/* Dashboard Header */}
              <header className="px-8 py-6 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-sm z-10">
                <div className="flex items-center gap-8">
                  <div className="flex items-center gap-4">
                    <div className="bg-indigo-600 w-14 h-14 hexagon flex items-center justify-center text-white shadow-xl shadow-indigo-500/20 shrink-0">
                      <Truck size={28} className="animate-pulse" />
                    </div>
                    <div>
                      <img 
                        src="https://lh3.googleusercontent.com/d/1Cd3dVNnqheL1GtcAgomBcyylCRw7s8x-" 
                        alt="Logo" 
                        className="h-10 mb-2 object-contain"
                        referrerPolicy="no-referrer"
                        crossOrigin="anonymous"
                      />
                      <h1 className="text-2xl font-black tracking-tighter text-slate-900 leading-none">VEHICLE<span className="text-indigo-600">TRACKER</span> MONITOR</h1>
                      <div className="flex items-center gap-3 mt-1.5">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                          <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">ONLINE</span>
                        </div>
                        <div className="h-3 w-px bg-slate-200" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Logistics Intelligence</span>
                      </div>
                    </div>
                  </div>

                  {/* Status Breakdown in Header */}
                  <div className="hidden 2xl:flex items-center gap-8 ml-8">

                    {/* Status Indicators */}
                    <div className="flex items-center gap-6">
                      {stats.list.map((s, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-full ${s.solidBg} flex items-center justify-center shadow-lg shadow-${s.solidBg.split('-')[1]}-500/20 shrink-0`}>
                            <s.icon size={20} className="text-white" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xl font-black text-slate-900 leading-none">{s.value}</span>
                            <div className="flex flex-col mt-1">
                              <span className="text-[10px] font-bold text-slate-400 leading-none mb-1">({s.percentage}%)</span>
                              <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider leading-none">{s.label}</span>
                              <span className="text-[8px] font-bold text-slate-300 leading-none mt-0.5">{s.subLabel}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Current Time</p>
                    <p className="text-xl font-black text-slate-900 tabular-nums">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</p>
                  </div>
                  <button 
                    onClick={() => setIsFullScreenSummary(false)}
                    className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black hover:bg-slate-800 transition-all flex items-center gap-2 shadow-xl active:scale-95 text-sm"
                  >
                    <Minimize2 size={18} />
                    Exit Monitor
                  </button>
                </div>
              </header>

              <main className="flex-1 flex overflow-hidden bg-slate-50">
                {/* Left Panel: Feed & Planload Status */}
                <aside className="w-[400px] bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-hidden shadow-lg z-10">
                  {/* Top Half: Live Feed */}
                  <div className="h-1/2 flex flex-col border-b border-slate-100">
                    <div className="p-6 bg-slate-50/50 border-b border-slate-100">
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Live Activity Feed</h3>
                    </div>
                    <div className="flex-1 overflow-hidden relative">
                      {(() => {
                        const activities = recentActivities.slice(0, 10);
                        const latestTime = activities.length > 0 ? Math.max(...activities.map(a => a.time)) : 0;
                        const latestMinute = Math.floor(latestTime / 60000);
                        
                        return (
                          <div className="absolute top-0 left-0 right-0 p-4 space-y-2 animate-marquee-vertical-dashboard">
                            {[...activities, ...activities].map((activity, idx) => {
                              const isLatest = Math.floor(activity.time / 60000) === latestMinute;
                              const Icon = getStatusIcon(activity.status);
                              return (
                                <div key={`${activity.vehicleNumber}-${idx}`} className="flex items-center gap-4 p-3 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-white hover:shadow-md hover:border-indigo-100 transition-all group relative overflow-hidden">
                                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${STATUS_SOLID_COLORS[activity.status]}`} />
                                  <div className={`w-12 h-12 rounded-xl ${STATUS_SOLID_COLORS[activity.status]} text-white flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/10`}>
                                    <Icon size={22} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <p className="text-base font-black text-slate-900 tracking-tight">{activity.vehicleNumber}</p>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        {isLatest && (
                                          <span className="flex h-2 w-2 rounded-full bg-red-500 animate-ping shrink-0" />
                                        )}
                                        <span className="text-[10px] font-black text-slate-400 tabular-nums">{new Date(activity.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-between mt-1">
                                      <div className="flex flex-col">
                                        <p className="text-[10px] font-bold text-slate-500 truncate uppercase tracking-wider">{activity.driverName}</p>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">T: {activity.trip} | S: {activity.sub}</p>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <span className={`text-[9px] font-black ${STATUS_COLORS[activity.status].split(' ')[1]} uppercase tracking-widest`}>
                                          {STATUS_LABELS[activity.status]}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Bottom Half: Planload Status */}
                  <div className="h-1/2 flex flex-col">
                    <div className="p-6 bg-slate-50/50 border-b border-slate-100">
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">PLANLOAD Status</h3>
                    </div>
                    <div className="flex-1 overflow-hidden relative p-4" style={{ perspective: '1200px' }}>
                      <AnimatePresence mode="wait">
                        {(() => {
                          const planLoads = [...new Set(latestVehicles.map(v => v.planLoad))].sort(sortPlanLoad);
                          if (planLoads.length === 0) return null;
                          const safeIndex = currentRoundIndex % planLoads.length;
                          const plan = planLoads[safeIndex];
                          const vehiclesInPlan = latestVehicles.filter(v => v.planLoad === plan);
                          const completed = vehiclesInPlan.filter(v => v.status === 'Check Out').length;
                          const total = vehiclesInPlan.length;
                          
                          return (
                            <motion.div 
                              key={plan}
                              initial={{ opacity: 0, rotateY: 90 }}
                              animate={{ opacity: 1, rotateY: 0 }}
                              exit={{ opacity: 0, rotateY: -90 }}
                              transition={{ duration: 0.5 }}
                              className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm h-full flex flex-col"
                            >
                              <div className="flex items-center justify-between mb-6">
                                <div className="flex flex-col">
                                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.3em]">PLANLOAD</span>
                                  <span className="text-2xl font-black text-slate-900 tracking-tighter leading-none">
                                    {(() => {
                                      const p = plan as string;
                                      const [h] = p.split(':');
                                      const hour = parseInt(h);
                                      const ampm = hour >= 12 ? 'PM' : 'AM';
                                      return `${p} ${ampm}`;
                                    })()}
                                  </span>
                                </div>
                                <div className="px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-lg">
                                  <span className="text-sm font-black text-indigo-600 tabular-nums">{completed}/{total}</span>
                                </div>
                              </div>
                              <div className="h-4 bg-slate-100 rounded-full overflow-hidden flex">
                                {STATUS_FLOW.map(status => {
                                  const count = vehiclesInPlan.filter(v => v.status === status).length;
                                  if (count === 0) return null;
                                  const width = (count / total) * 100;
                                  return (
                                    <div 
                                      key={status} 
                                      className={`h-full ${STATUS_SOLID_COLORS[status]}`} 
                                      style={{ width: `${width}%` }}
                                    />
                                  );
                                })}
                              </div>
                              <div className="grid grid-cols-3 gap-x-4 gap-y-8 mt-8">
                                {STATUS_FLOW.map(status => {
                                  const count = vehiclesInPlan.filter(v => v.status === status).length;
                                  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
                                  const Icon = getStatusIcon(status);
                                  return (
                                    <div key={status} className="flex flex-col">
                                      <div className="flex items-center gap-3 mb-2">
                                        <div className={`w-10 h-10 rounded-full ${STATUS_SOLID_COLORS[status]} text-white flex items-center justify-center shadow-md shrink-0`}>
                                          <Icon size={18} strokeWidth={2.5} />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate leading-none mb-1">
                                            {STATUS_ABBR[status]}
                                          </span>
                                          <div className="flex flex-col items-start gap-0.5">
                                            <span className="text-2xl font-black text-slate-900 leading-none">{count}</span>
                                            <span className="text-[10px] font-bold text-slate-400">({percentage}%)</span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </motion.div>
                          );
                        })()}
                      </AnimatePresence>
                    </div>
                  </div>
                </aside>
                {/* Main Panel: Live Monitor */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                        <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">
                          LIVE Queue Monitor
                        </h2>
                      </div>
                      
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.3em]">PLANDATE</span>
                        <div className="text-4xl font-black text-slate-900 tracking-tighter leading-none mb-2">
                          {latestDate || '--/--/--'}
                        </div>
                      </div>
                      
                      <div className="h-8 w-px bg-slate-200" />
                      
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.3em]">PLANLOAD</span>
                        <div className="text-4xl font-black text-slate-900 tracking-tighter leading-none mb-2">
                          {(() => {
                            const activePlanGroups = [...new Set(latestVehicles.map(v => v.planLoad))].sort(sortPlanLoad) as string[];
                            const safeIndex = currentRoundIndex % activePlanGroups.length;
                            const plan = activePlanGroups[safeIndex] || '--:--';
                            if (plan === '--:--') return plan;
                            const [h] = plan.split(':');
                            const hour = parseInt(h);
                            const ampm = hour >= 12 ? 'PM' : 'AM';
                            return `${plan} ${ampm}`;
                          })()}
                        </div>
                        {(() => {
                          const activePlanGroups = [...new Set(latestVehicles.map(v => v.planLoad))].sort(sortPlanLoad) as string[];
                          if (activePlanGroups.length <= 1) return null;
                          return (
                            <div className="flex items-center gap-1.5">
                              {activePlanGroups.map((_, idx) => (
                                <div 
                                  key={idx} 
                                  onClick={() => setCurrentRoundIndex(idx)}
                                  className={`h-1 rounded-full transition-all duration-700 cursor-pointer hover:bg-indigo-300 ${idx === currentRoundIndex % activePlanGroups.length ? 'w-8 bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'w-1.5 bg-slate-200'}`} 
                                />
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="flex items-center gap-8">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active</span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Completed</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  
                  {/* Monitor List */}
                  <div ref={dashboardScrollRef} className="flex-1 overflow-hidden bg-white flex flex-col">
                    <AnimatePresence mode="wait">
                      {(() => {
                        const activePlanGroups = [...new Set(latestVehicles.map(v => v.planLoad))].sort(sortPlanLoad);
                        
                        if (activePlanGroups.length === 0) {
                          return (
                            <motion.div 
                              key="empty"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="h-full flex flex-col items-center justify-center text-slate-700 space-y-8"
                            >
                              <div className="w-32 h-32 bg-slate-900 hexagon flex items-center justify-center text-slate-800 border border-slate-800">
                                <Truck size={64} strokeWidth={1} />
                              </div>
                              <p className="text-2xl font-black uppercase tracking-[0.3em]">No Active Operations</p>
                            </motion.div>
                          );
                        }

                        const safeIndex = currentRoundIndex % activePlanGroups.length;
                        const plan = activePlanGroups[safeIndex];

                        return (
                          <motion.div 
                            key={plan}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="w-full h-full flex flex-col"
                          >
                            {/* Table Header - Stays fixed at top */}
                            <div className="z-10 bg-slate-900 text-white grid grid-cols-[110px_1fr_2fr_1.5fr_2fr_140px_120px] gap-6 px-10 py-5 text-[11px] font-black uppercase tracking-[0.25em] border-b border-slate-800 shrink-0">
                              <div className="pl-[52px]">Queue</div>
                              <div>Vehicle</div>
                              <div>Driver</div>
                              <div>Status</div>
                              <div>Trip Number</div>
                              <div>Turnaround Time</div>
                              <div>Last Updated</div>
                            </div>

                            {/* Scrollable Body Container */}
                            <div className="flex-1 overflow-hidden relative">
                              <div className="scroll-content will-change-transform divide-y divide-slate-100">
                                {latestVehicles
                                  .filter(v => v.planLoad === plan)
                                  .sort((a, b) => (vehicleQueues[a.id] || 999) - (vehicleQueues[b.id] || 999))
                                  .map((v, idx) => {
                                    const isCheckOut = v.status === 'Check Out';
                                    const effData = getEfficiencyData(v);
                                    
                                    return (
                                      <div 
                                        key={v.id} 
                                        className={`grid grid-cols-[110px_1fr_2fr_1.5fr_2fr_140px_120px] gap-6 px-10 py-6 items-center transition-colors hover:bg-indigo-50/30 ${isCheckOut ? 'bg-emerald-50/40' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                                      >
                                        <div className="flex items-center gap-3">
                                          <div className="w-10 h-10 shrink-0 flex items-center justify-center">
                                            {v.invoiceCompleted && (
                                              <div className="flex items-center justify-center w-full h-full rounded-full bg-emerald-100 text-emerald-600 shadow-sm border border-emerald-200" title="Invoice Completed">
                                                <FileCheck size={20} />
                                              </div>
                                            )}
                                          </div>
                                          <div className={`w-14 h-14 rounded-xl ${STATUS_SOLID_COLORS[v.status]} text-white flex flex-col items-center justify-center shadow-md shrink-0`}>
                                            <span className="text-[10px] font-black opacity-70 leading-none mb-1">
                                              {v.planLoad || '--:--'}
                                            </span>
                                            <span className="text-2xl font-black leading-none">
                                              {vehicleQueues[v.id] || '-'}
                                            </span>
                                          </div>
                                        </div>
                                        
                                        <div className="flex flex-col">
                                          <span className="text-2xl font-black text-slate-900 tracking-tight leading-tight">
                                            {v.vehicleNumber}
                                          </span>
                                        </div>

                                        <div className="flex flex-col">
                                          <span className="text-lg font-black text-slate-700 tracking-tight leading-tight truncate">
                                            {v.driverName}
                                          </span>
                                        </div>
                                        
                                        <div>
                                          <div className={`inline-flex flex-col px-4 py-2 rounded-xl border ${STATUS_COLORS[v.status]} border-current/10 shadow-sm bg-white/50`}>
                                            <span className="text-xs font-black uppercase tracking-widest leading-tight">
                                              {STATUS_LABELS[v.status]}
                                            </span>
                                            <span className="text-[10px] font-bold mt-0.5 opacity-80 uppercase tracking-wider">
                                              {STATUS_THAI_LABELS[v.status]}
                                            </span>
                                          </div>
                                        </div>
                                        
                                        <div className="flex flex-col">
                                          <span className="text-xl font-black text-indigo-600 tabular-nums leading-tight">
                                            {v.tripC || '-'}
                                          </span>
                                          <span className="text-xs font-bold text-slate-400 truncate mt-1">
                                            {v.trip || '-'}
                                          </span>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                          {(() => {
                                            const tatMins = getTurnaroundTime(v.checkIn, v.checkOut);
                                            if (tatMins === null) return <span className="text-sm font-bold text-slate-300">N/A</span>;
                                            return (
                                              <span className={`text-lg font-black ${v.checkOut ? 'text-emerald-500' : 'text-red-500'}`}>
                                                {formatEfficiency(tatMins)}
                                              </span>
                                            );
                                          })()}
                                        </div>
                                        
                                        <div className="flex items-center gap-2 text-slate-500">
                                          <Clock size={16} />
                                          <span className="text-base font-bold tabular-nums">
                                            {v.invoiceReceiving ? new Date(v.invoiceReceiving).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '--:--'}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })()}
                    </AnimatePresence>
                  </div>
                </div>
              </main>
              <footer className="px-8 py-4 bg-white border-t border-slate-200 flex items-center justify-center shrink-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                  VehicleTracker • © 2026 AFC IT Support
                </p>
              </footer>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
