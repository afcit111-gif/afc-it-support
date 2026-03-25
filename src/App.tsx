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
  RefreshCw,
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
  Table,
  Activity,
  Edit2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { domToPng } from 'modern-screenshot';
import { VehicleRecord, Status } from './types';
import { 
  STATUS_FLOW, 
  STATUS_LABELS, 
  STATUS_PERCENTAGES, 
  STATUS_COLORS,
  STATUS_SOLID_COLORS,
  STATUS_HEX_COLORS,
  sortPlanLoad
} from './constants';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
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

  // Test connection to Firestore
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
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
      setMetricsView(prev => prev === 'overview' ? 'efficiency' : 'overview');
    }, 20000); // Rotate metrics every 20 seconds
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
      handleFirestoreError(error, OperationType.UPDATE, 'vehicles');
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
      handleFirestoreError(error, OperationType.UPDATE, 'vehicles');
    }
  };

  const handleStatusRevert = async (id: string, currentStatus: Status) => {
    if (!user) return;

    const currentIndex = STATUS_FLOW.indexOf(currentStatus);
    if (currentIndex <= 0) return;

    const prevStatus = STATUS_FLOW[currentIndex - 1];
    
    setConfirm({
      title: 'Confirm Revert',
      icon: <RefreshCw size={32} />,
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
          handleFirestoreError(error, OperationType.UPDATE, 'vehicles');
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
          handleFirestoreError(error, OperationType.UPDATE, 'vehicles');
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
    const dataToExport = data.map(v => {
      const qNum = vehicleQueues[v.id];
      
      return {
        'Seq': v.seqLoading,
        'Delivery Date': v.deliveryDate,
        'Trip': v.trip,
        'Sub': v.sub,
        'Plan Load': v.planLoad,
        'Queue': qNum || '-',
        'Driver': v.driverName,
        'Phone': v.driverPhone,
        'Vehicle': v.vehicleNumber,
        'Status': STATUS_LABELS[v.status],
        'Remark': v.remark || '-',
        'Check-In': v.checkIn ? new Date(v.checkIn).toLocaleTimeString() : '-',
        'Document Received': v.invoiceReceiving ? new Date(v.invoiceReceiving).toLocaleTimeString() : '-',
        'Checking': v.checking ? new Date(v.checking).toLocaleTimeString() : '-',
        'Loading': v.handover ? new Date(v.handover).toLocaleTimeString() : '-',
        'Check-Out': v.checkOut ? new Date(v.checkOut).toLocaleTimeString() : '-',
        'Total Time': v.totalTime || '-',
        'Archived At': v.archivedAt ? new Date(v.archivedAt).toLocaleString() : '-'
      };
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Vehicles");
    XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleCaptureSummary = async (type: 'all' | 'handover' = 'all') => {
    const targetRef = type === 'all' ? summaryRef : handOverRef;
    if (!targetRef.current) return;
    
    try {
      showToast(`Capturing ${type === 'all' ? 'summary' : 'handover progress'}...`, 'success');
      
      // Find scrollable container if it's the "all" capture
      const scrollContainer = type === 'all' ? targetRef.current.querySelector('.overflow-y-auto') as HTMLElement : null;
      const originalMaxHeight = scrollContainer?.style.maxHeight;
      const originalOverflow = scrollContainer?.style.overflow;

      if (scrollContainer) {
        scrollContainer.style.maxHeight = 'none';
        scrollContainer.style.overflow = 'visible';
      }

      const dataUrl = await domToPng(targetRef.current, {
        backgroundColor: '#ffffff',
        scale: 2, // Higher quality
        quality: 1,
      });

      if (scrollContainer) {
        scrollContainer.style.maxHeight = originalMaxHeight || '';
        scrollContainer.style.overflow = originalOverflow || '';
      }
      
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${type === 'all' ? 'Vehicle_Summary' : 'HandOver_Progress'}_${new Date().toISOString().split('T')[0]}.png`;
      link.click();
      showToast(`${type === 'all' ? 'Summary' : 'Handover progress'} captured successfully!`, 'success');
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

      const batchId = `batch-${Date.now()}`;
      const uploadTimestamp = new Date().toISOString();

      const newRecords: VehicleRecord[] = data.map((row, index) => {
        const planLoad = formatExcelTime(row['Plan Load']);
        const vehiclePlan = formatExcelTime(row['Vehicle Plan'] || row['Plan Load']);
        
        return {
          id: `v-${Date.now()}-${index}`,
          seqLoading: row['Seq'] || row['Seq Loading'] || index + 1,
          deliveryDate: formatExcelDate(row['Delivery Date']),
          tripC: row['Trip C'] || '',
          trip: row['Trip'] || '',
          sub: row['Sub'] || '',
          planLoad: planLoad,
          driverName: row['Driver Name'] || '',
          driverPhone: cleanInput(row['Driver Phone'] || ''),
          vehicleNumber: cleanInput(row['Vehicle Number'] || ''),
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
        handleFirestoreError(error, OperationType.WRITE, 'vehicles');
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
      handleFirestoreError(error, OperationType.WRITE, 'vehicles');
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
      'Seq Loading': 1,
      'Delivery Date': '2026-03-21',
      'Trip C': 'C1',
      'Trip': 'Trip 1',
      'Sub': 'Ezie',
      'Plan Load': '18:30',
      'Driver Name': 'John Doe',
      'Driver Phone': '0812345678',
      'Vehicle Number': 'กข1234',
      'Vehicle Sub': 'Sub 1',
      'Vehicle Plan': '18:30',
      'Remark': ''
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

      // Initial delay before starting to scroll
      initialDelay = setTimeout(() => {
        scrollInterval = setInterval(() => {
          if (!container) return;

          const isAtBottom = Math.ceil(container.scrollTop + container.clientHeight) >= container.scrollHeight;

          if (isAtBottom) {
            clearInterval(scrollInterval);
            // Wait at bottom before switching
            nextRoundTimeout = setTimeout(() => {
              if (dashboardPlanFilter === 'All' && activePlanGroups.length > 1) {
                setCurrentRoundIndex((prev) => (prev + 1) % activePlanGroups.length);
              } else {
                // If only one plan or filtered, restart scroll
                startAutoScroll();
              }
            }, 5000);
          } else {
            container.scrollTop += 1;
          }
        }, 40); // Slightly faster scrolling
      }, 3000);
    };

    startAutoScroll();

    return () => {
      clearInterval(scrollInterval);
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

      // Wait a bit before starting to scroll
      pauseTimeout = setTimeout(() => {
        scrollInterval = setInterval(() => {
          if (!container) return;

          // Add a small threshold to avoid float precision issues
          const isAtBottom = Math.ceil(container.scrollTop + container.clientHeight) >= container.scrollHeight - 1;

          if (isAtBottom) {
            clearInterval(scrollInterval);
            // Wait at bottom for 5 seconds before restarting
            pauseTimeout = setTimeout(startAutoScroll, 5000);
          } else {
            container.scrollTop += 1;
          }
        }, 50); // Slightly faster scroll
      }, 3000);
    };

    // Small delay to ensure DOM is ready
    startTimeout = setTimeout(startAutoScroll, 500);

    return () => {
      clearTimeout(startTimeout);
      clearTimeout(pauseTimeout);
      clearInterval(scrollInterval);
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
      const matchesStatus = statusFilter === 'All' || v.status === statusFilter;
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

  const stats = useMemo(() => {
    const total = filteredVehicles.length;
    const waiting = filteredVehicles.filter(v => v.status === 'Waiting').length;
    const inProgress = filteredVehicles.filter(v => v.status !== 'Waiting' && v.status !== 'Check Out').length;
    const completed = filteredVehicles.filter(v => v.status === 'Check Out').length;
    const getPercentage = (count: number) => total > 0 ? Math.round((count / total) * 100) : 0;

    return [
      { label: 'Total Vehicles', value: total, icon: Truck, color: 'text-blue-600', percentage: 100, bg: 'bg-blue-50' },
      { label: 'Waiting', value: waiting, icon: Clock, color: 'text-blue-600', percentage: getPercentage(waiting), bg: 'bg-blue-50' },
      { label: 'In Progress', value: inProgress, icon: RefreshCw, color: 'text-orange-600', percentage: getPercentage(inProgress), bg: 'bg-orange-50' },
      { label: 'Completed', value: completed, icon: CheckCircle2, color: 'text-green-600', percentage: getPercentage(completed), bg: 'bg-green-50' },
    ];
  }, [filteredVehicles]);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
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
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Truck className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-stone-900 mb-2">Vehicle Loading Tracker</h1>
          <p className="text-stone-500 mb-8">Please login with your Google account to access the tracker.</p>
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white border border-stone-300 text-stone-700 px-6 py-3 rounded-xl font-medium hover:bg-stone-50 transition-colors shadow-sm"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
            Login with Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top Row: Brand & User */}
          <div className="py-4 flex items-center justify-between border-b border-stone-100">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-100">
                  <LayoutDashboard size={24} />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-stone-900">Vehicle Loading Tracker</h1>
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5">
                    <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
                    Last updated: {lastUpdated.toLocaleTimeString()}
                  </p>
                </div>
              </div>

              {/* Stats in Header */}
              <div className="hidden lg:flex items-center gap-4 flex-1 justify-center px-8">
                {stats.map((stat, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-white border border-stone-200 shadow-sm min-w-[160px]">
                    <div className={`p-2.5 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center`}>
                      <stat.icon size={20} />
                    </div>
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-black text-stone-900 leading-none">{stat.value}</span>
                        {stat.label !== 'Total Vehicles' && (
                          <span className="text-[10px] font-bold text-stone-400">({stat.percentage}%)</span>
                        )}
                      </div>
                      <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest mt-1 leading-none">{stat.label.replace(' Vehicles', '')}</p>
                    </div>
                  </div>
                ))}
              </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 pr-4 border-r border-stone-200">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-bold text-stone-900 leading-none">{user.displayName}</p>
                  <p className="text-[10px] text-stone-400 mt-1">{user.email}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 font-bold text-xs border border-stone-200">
                  {user.displayName?.charAt(0)}
                </div>
                <button 
                  onClick={handleLogout}
                  className="p-2 text-stone-400 hover:text-red-600 transition-colors"
                  title="Logout"
                >
                  <LogOut size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Row: Filters & Actions */}
          <div className="py-3 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div className="flex flex-col md:flex-row md:items-center gap-3 flex-1">
              {/* Search */}
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Search driver/vehicle..." 
                  className="pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 rounded-xl text-sm transition-all w-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Filter Group */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 px-2 py-1 rounded-xl">
                  <span className="text-[9px] font-black text-stone-400 uppercase tracking-tighter border-r border-stone-200 pr-1.5 mr-0.5">SUB</span>
                  <Filter size={14} className="text-stone-400" />
                  <select 
                    className="bg-transparent border-none text-[11px] font-bold focus:ring-0 pr-7 py-0.5"
                    value={subFilter}
                    onChange={(e) => setSubFilter(e.target.value)}
                  >
                    {subOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>

                <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 px-2 py-1 rounded-xl">
                  <span className="text-[9px] font-black text-stone-400 uppercase tracking-tighter border-r border-stone-200 pr-1.5 mr-0.5">Date</span>
                  <Calendar size={14} className="text-stone-400" />
                  <select 
                    className="bg-transparent border-none text-[11px] font-bold focus:ring-0 pr-7 py-0.5"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                  >
                    {dateOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>

                <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 px-2 py-1 rounded-xl">
                  <span className="text-[9px] font-black text-stone-400 uppercase tracking-tighter border-r border-stone-200 pr-1.5 mr-0.5">Time</span>
                  <Clock size={14} className="text-stone-400" />
                  <select 
                    className="bg-transparent border-none text-[11px] font-bold focus:ring-0 pr-7 py-0.5"
                    value={timeFilter}
                    onChange={(e) => setTimeFilter(e.target.value)}
                  >
                    <option value="All">All Time</option>
                    {timeOptions.filter(t => t !== 'All').map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 px-2 py-1 rounded-xl">
                  <span className="text-[9px] font-black text-stone-400 uppercase tracking-tighter border-r border-stone-200 pr-1.5 mr-0.5">Status</span>
                  <CheckCircle2 size={14} className="text-stone-400" />
                  <select 
                    className="bg-transparent border-none text-[11px] font-bold focus:ring-0 pr-7 py-0.5"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="All">All Status</option>
                    {STATUS_FLOW.map(status => (
                      <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Actions Group */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 xl:pb-0 no-scrollbar">
              <div className="flex items-center bg-stone-100 p-1 rounded-xl gap-1">
                <button
                  onClick={() => setShowSummary(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold hover:bg-white hover:shadow-sm transition-all whitespace-nowrap"
                >
                  <BarChart3 size={14} />
                  Summary
                </button>
                <button
                  onClick={() => setShowHistory(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold hover:bg-white hover:shadow-sm transition-all whitespace-nowrap"
                >
                  <History size={14} />
                  History
                </button>
              </div>

              <div className="h-6 w-px bg-stone-200 mx-1" />

              <button
                onClick={() => {
                  const subs = subOptions.filter(opt => opt !== 'All');
                  const times = timeOptions.filter(opt => opt !== 'All');
                  setNewVehicle({
                    ...newVehicle,
                    deliveryDate: new Date().toISOString().split('T')[0],
                    sub: subs.length > 0 ? subs[0] : 'Other',
                    planLoad: times.length > 0 ? times[0] : '18:30',
                    vehiclePlan: times.length > 0 ? times[0] : '18:30',
                    vehicleNumber: '',
                    driverName: '',
                    driverPhone: ''
                  });
                  setShowAddModal(true);
                }}
                className="flex items-center gap-1.5 bg-stone-900 text-white px-3 py-2 rounded-xl text-[11px] font-bold hover:bg-stone-800 transition-colors whitespace-nowrap"
              >
                <Plus size={14} />
                Add
              </button>

              <label className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-2 rounded-xl text-[11px] font-bold hover:bg-indigo-700 transition-colors cursor-pointer whitespace-nowrap">
                <FileUp size={14} />
                Import
                <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleImportExcel} />
              </label>

              <button
                onClick={() => handleExportExcel(filteredVehicles, 'Vehicle_Tracker_Export')}
                className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-2 rounded-xl text-[11px] font-bold hover:bg-emerald-700 transition-colors whitespace-nowrap"
              >
                <FileDown size={14} />
                Export
              </button>

              <button
                onClick={() => setShowArchiveHistory(true)}
                className="p-2 text-stone-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                title="View Archive History"
              >
                <History size={18} />
              </button>

              <button
                onClick={handleArchiveAll}
                className="p-2 text-stone-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                title="Archive all data"
              >
                <Archive size={16} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Edit Driver Modal */}
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-2xl max-w-2xl w-full overflow-hidden border border-stone-200"
            >
              <div ref={summaryRef} className="bg-white rounded-[2.5rem] overflow-hidden">
                {/* Header */}
                <div className="p-8 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
                  <div className="flex items-center gap-4">
                    <div className="bg-indigo-600 w-12 h-12 rounded-2xl text-white flex items-center justify-center shadow-lg shadow-indigo-100">
                      <LayoutDashboard size={24} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-stone-900 tracking-tight">Quick Summary</h2>
                      {(() => {
                        const latestDate = vehicles.length > 0 
                          ? [...new Set(vehicles.map(v => v.deliveryDate))].sort((a, b) => new Date(b as string).getTime() - new Date(a as string).getTime())[0]
                          : 'No Data';
                        return (
                          <p className="text-xs font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2 mt-0.5">
                            <Calendar size={12} />
                            Plan Date: {latestDate}
                          </p>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setIsFullScreenSummary(true)} 
                      className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100"
                      title="Open Full Dashboard"
                    >
                      <Monitor size={16} />
                      Dashboard Mode
                    </button>
                    <button 
                      onClick={() => setShowSummary(false)} 
                      className="w-10 h-10 flex items-center justify-center hover:bg-stone-200 rounded-full transition-all text-stone-400 hover:text-stone-900"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>
                
                <div className="p-8 space-y-10 bg-white max-h-[70vh] overflow-y-auto custom-scrollbar">
                  {(() => {
                    const latestDate = vehicles.length > 0 
                      ? [...new Set(vehicles.map(v => v.deliveryDate))].sort((a, b) => new Date(b as string).getTime() - new Date(a as string).getTime())[0]
                      : null;
                    
                    const latestVehicles = latestDate 
                      ? vehicles.filter(v => v.deliveryDate === latestDate)
                      : [];

                    const total = latestVehicles.length;
                    const completed = latestVehicles.filter(v => v.status === 'Check Out').length;
                    const inProgress = latestVehicles.filter(v => v.status !== 'Waiting' && v.status !== 'Check Out').length;
                    const waiting = latestVehicles.filter(v => v.status === 'Waiting').length;
                    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

                    return (
                      <>
                        {/* Key Stats */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          {[
                            { label: 'Total', value: total, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                            { label: 'Waiting', value: waiting, color: 'text-stone-400', bg: 'bg-stone-50' },
                            { label: 'In Progress', value: inProgress, color: 'text-amber-600', bg: 'bg-amber-50' },
                            { label: 'Completed', value: completed, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                          ].map((s, i) => (
                            <div key={i} className={`${s.bg} p-6 rounded-[2rem] text-center transition-transform hover:scale-[1.02]`}>
                              <p className={`text-3xl font-black ${s.color} mb-1`}>{s.value}</p>
                              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">{s.label}</p>
                            </div>
                          ))}
                        </div>

                        {/* Progress Visual */}
                        <div className="space-y-6">
                          <div className="flex items-end justify-between">
                            <div>
                              <h3 className="text-sm font-bold text-stone-400 uppercase tracking-widest mb-1">Overall Progress</h3>
                              <p className="text-5xl font-black text-stone-900 tracking-tighter">{completionRate}%</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-stone-400 uppercase tracking-widest mb-1">Status</p>
                              <p className={`text-sm font-bold px-3 py-1 rounded-full ${completionRate === 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                {completionRate === 100 ? 'All Completed' : 'In Operation'}
                              </p>
                            </div>
                          </div>
                          
                          <div className="h-4 w-full bg-stone-100 rounded-full overflow-hidden flex shadow-inner">
                            {STATUS_FLOW.map(status => {
                              const count = latestVehicles.filter(v => v.status === status).length;
                              const percentage = total > 0 ? (count / total) * 100 : 0;
                              return (
                                <motion.div 
                                  key={status}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${percentage}%` }}
                                  transition={{ duration: 1, ease: "easeOut" }}
                                  style={{ backgroundColor: STATUS_HEX_COLORS[status] }}
                                  className="h-full"
                                  title={`${STATUS_LABELS[status]}: ${count}`}
                                />
                              );
                            })}
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-6">
                            {STATUS_FLOW.map(status => {
                              const count = latestVehicles.filter(v => v.status === status).length;
                              return (
                                <div key={status} className="flex items-center justify-between text-xs border-b border-stone-50 pb-2">
                                  <div className="flex items-center gap-2">
                                    <div 
                                      className="w-2.5 h-2.5 rounded-full" 
                                      style={{ backgroundColor: STATUS_HEX_COLORS[status] }}
                                    />
                                    <span className="font-bold text-stone-500 whitespace-pre-line">{STATUS_LABELS[status]}</span>
                                  </div>
                                  <span className="font-black text-stone-900">{count}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Efficiency */}
                        <div className="bg-stone-900 rounded-[2rem] p-8 text-white relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-8 opacity-10">
                            <Clock size={80} />
                          </div>
                          <div className="relative z-10">
                            <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4">Efficiency Metrics</h3>
                            {(() => {
                              const completedVehicles = latestVehicles.filter(v => v.status === 'Check Out');
                              const avgTime = completedVehicles.length > 0 
                                ? (completedVehicles.reduce((acc, v) => {
                                    const [h, m] = (v.totalTime || '0h 0m').split(' ').map(s => parseInt(s));
                                    return acc + (h * 60 + (m || 0));
                                  }, 0) / completedVehicles.length).toFixed(0)
                                : 0;

                              return (
                                <div className="grid grid-cols-4 gap-4">
                                  <div className="border-r border-white/10 pr-4">
                                    <p className="text-4xl font-black text-white">{avgTime}</p>
                                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Avg Mins / Vehicle</p>
                                  </div>
                                  <div className="border-r border-white/10 pr-4">
                                    <p className="text-4xl font-black text-white">{completedVehicles.length}</p>
                                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Total Handled</p>
                                  </div>
                                  <div className="border-r border-white/10 pr-4">
                                    <p className="text-4xl font-black text-emerald-400">
                                      {latestVehicles.filter(v => v.status !== 'Waiting' && getDelayStatus(v.deliveryDate, v.planLoad, v.checkIn)?.status === 'On Time').length}
                                    </p>
                                    <p className="text-[10px] font-bold text-emerald-400/70 uppercase tracking-widest">On Time</p>
                                  </div>
                                  <div>
                                    <p className="text-4xl font-black text-red-400">
                                      {latestVehicles.filter(v => v.status !== 'Waiting' && getDelayStatus(v.deliveryDate, v.planLoad, v.checkIn)?.status === 'Delay').length}
                                    </p>
                                    <p className="text-[10px] font-bold text-red-400/70 uppercase tracking-widest">Delayed</p>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Hand Over Progress Table */}
                        <div className="space-y-4 bg-white p-1" ref={handOverRef}>
                          <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest">Hand Over Progress</h3>
                            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5">
                              <Calendar size={10} />
                              Plan Date: {latestDate}
                            </p>
                          </div>
                          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs border-collapse">
                                <thead>
                                  <tr className="bg-stone-900 text-white">
                                    <th className="p-3 font-bold text-center uppercase tracking-widest border-r border-stone-800">Plan</th>
                                    <th className="p-3 font-bold text-center uppercase tracking-widest border-r border-stone-800">Total Trips</th>
                                    <th className="p-3 font-bold text-center uppercase tracking-widest border-r border-stone-800 bg-orange-500">Check-in</th>
                                    <th className="p-3 font-bold text-center uppercase tracking-widest border-r border-stone-800 bg-amber-700/50">Handover</th>
                                    <th className="p-3 font-bold text-center uppercase tracking-widest border-r border-stone-800 bg-emerald-700/50">Check-Out</th>
                                    <th className="p-3 font-bold text-center uppercase tracking-widest">% Percentage</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(() => {
                                    const planGroups = [...new Set(latestVehicles.map(v => v.planLoad))].sort(sortPlanLoad);
                                    const progress = planGroups.map(plan => {
                                      const roundVehicles = latestVehicles.filter(v => v.planLoad === plan);
                                      const trips = roundVehicles.length;
                                      const checkIn = roundVehicles.filter(v => v.status !== 'Waiting').length;
                                      const completed = roundVehicles.filter(v => v.status === 'Check Out').length;
                                      const startHandover = checkIn - completed;
                                      const percentage = trips > 0 ? (completed / trips) * 100 : 0;
                                      return { plan, trips, checkIn, startHandover, completed, percentage };
                                    });

                                    return (
                                      <>
                                        {progress.map((row, idx) => (
                                          <tr key={idx} className="font-bold text-stone-900 border-b border-stone-50 hover:bg-stone-50/50 transition-colors">
                                            <td className="p-3 border-r border-stone-50 text-center bg-stone-50/30">{row.plan}</td>
                                            <td className="p-3 border-r border-stone-50 text-center">{row.trips}</td>
                                            <td className="p-3 border-r border-stone-50 text-center text-orange-600 bg-orange-50/10">{row.checkIn}</td>
                                            <td className="p-3 border-r border-stone-50 text-center text-amber-600 bg-amber-50/10">{row.startHandover}</td>
                                            <td className="p-3 border-r border-stone-50 text-center text-emerald-600 bg-emerald-50/10">{row.completed}</td>
                                            <td className={`p-3 text-center ${
                                              row.percentage === 100 ? 'text-emerald-600' : 
                                              row.percentage > 0 ? 'text-amber-600' : 'text-red-600'
                                            }`}>
                                              <div className="flex items-center justify-center gap-2">
                                                <div className="w-12 h-1.5 bg-stone-100 rounded-full overflow-hidden hidden sm:block">
                                                  <div 
                                                    className={`h-full rounded-full ${row.percentage === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                                    style={{ width: `${row.percentage}%` }}
                                                  />
                                                </div>
                                                <span>{row.percentage.toFixed(2)}%</span>
                                              </div>
                                            </td>
                                          </tr>
                                        ))}
                                        <tr className="bg-stone-900 text-white font-bold">
                                          <td className="p-3 border-r border-stone-800 text-center">Total</td>
                                          <td className="p-3 border-r border-stone-800 text-center">
                                            {progress.reduce((acc, curr) => acc + curr.trips, 0)}
                                          </td>
                                          <td className="p-3 border-r border-stone-800 text-center bg-orange-500">
                                            {progress.reduce((acc, curr) => acc + curr.checkIn, 0)}
                                          </td>
                                          <td className="p-3 border-r border-stone-800 text-center bg-amber-700/50">
                                            {progress.reduce((acc, curr) => acc + curr.startHandover, 0)}
                                          </td>
                                          <td className="p-3 border-r border-stone-800 text-center bg-emerald-700/50">
                                            {progress.reduce((acc, curr) => acc + curr.completed, 0)}
                                          </td>
                                          <td className="p-3 text-center bg-stone-900">
                                            {(() => {
                                              const totalTrips = progress.reduce((acc, curr) => acc + curr.trips, 0);
                                              const totalCompleted = progress.reduce((acc, curr) => acc + curr.completed, 0);
                                              return totalTrips > 0 ? ((totalCompleted / totalTrips) * 100).toFixed(2) : '0.00';
                                            })()}%
                                          </td>
                                        </tr>
                                      </>
                                    );
                                  })()}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="p-8 bg-stone-50/50 border-t border-stone-100 flex flex-col sm:flex-row gap-4 justify-between items-center">
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                  <button 
                    onClick={() => handleCaptureSummary('all')}
                    className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95 text-sm"
                  >
                    <Camera size={18} />
                    Capture: Overall
                  </button>
                  <button 
                    onClick={() => handleCaptureSummary('handover')}
                    className="flex items-center justify-center gap-2 bg-stone-900 text-white px-6 py-4 rounded-2xl font-bold hover:bg-stone-800 transition-all shadow-xl shadow-stone-200 active:scale-95 text-sm"
                  >
                    <Table size={18} />
                    Capture: Hand Over Progress
                  </button>
                </div>
                <button 
                  onClick={() => setShowSummary(false)}
                  className="w-full sm:w-auto bg-white border border-stone-200 text-stone-600 px-10 py-4 rounded-2xl font-bold hover:bg-stone-50 transition-all active:scale-95 text-sm"
                >
                  Close Report
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
                    <RefreshCw size={20} />
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Vehicle List */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50 border-bottom border-stone-200">
                  <th className="px-6 py-4 text-xs font-semibold text-stone-500 uppercase tracking-wider text-center">Queue</th>
                  <th className="px-6 py-4 text-xs font-semibold text-stone-500 uppercase tracking-wider min-w-[140px]">Plan & SUB</th>
                  <th className="px-6 py-4 text-xs font-semibold text-stone-500 uppercase tracking-wider">Vehicle & Driver</th>
                  <th className="px-6 py-4 text-xs font-semibold text-stone-500 uppercase tracking-wider">Status & Progress</th>
                  <th className="px-6 py-4 text-xs font-semibold text-stone-500 uppercase tracking-wider min-w-[120px]">Timestamps</th>
                  <th className="px-6 py-4 text-xs font-semibold text-stone-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td className="px-6 py-4 text-center"><Skeleton className="w-8 h-8 rounded-full mx-auto" /></td>
                      <td className="px-6 py-4"><div className="space-y-2"><Skeleton className="w-24 h-4" /><Skeleton className="w-32 h-4" /><Skeleton className="w-16 h-4" /></div></td>
                      <td className="px-6 py-4"><div className="flex items-center gap-3"><Skeleton className="w-10 h-10 rounded-full" /><div className="space-y-2"><Skeleton className="w-32 h-5" /><Skeleton className="w-24 h-3" /><Skeleton className="w-24 h-3" /></div></div></td>
                      <td className="px-6 py-4"><div className="space-y-2"><div className="flex justify-between"><Skeleton className="w-20 h-10 rounded-2xl" /><Skeleton className="w-10 h-6" /></div><Skeleton className="w-full h-1.5 rounded-full" /></div></td>
                      <td className="px-6 py-4"><div className="space-y-2"><Skeleton className="w-24 h-4" /><Skeleton className="w-24 h-4" /><Skeleton className="w-24 h-4" /></div></td>
                      <td className="px-6 py-4 text-right"><Skeleton className="w-24 h-10 rounded-2xl ml-auto" /></td>
                    </tr>
                  ))
                ) : (
                  <AnimatePresence mode="popLayout">
                    {filteredVehicles.map((vehicle) => (
                      <motion.tr 
                        key={vehicle.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="hover:bg-stone-50/50 transition-colors"
                      >
                        <td className="px-6 py-4 text-center">
                          {vehicleQueues[vehicle.id] ? (
                            <div className="inline-flex flex-col items-center justify-center min-w-[90px] p-3 rounded-2xl border-2 border-indigo-200 bg-white shadow-md">
                              <span className="text-base font-black text-indigo-600 mb-2">{vehicle.planLoad}</span>
                              <div className={`flex items-center justify-center w-10 h-10 rounded-full ${STATUS_SOLID_COLORS[vehicle.status]} text-white font-black text-xl shadow-inner transition-colors duration-300`}>
                                {vehicleQueues[vehicle.id]}
                              </div>
                            </div>
                          ) : (
                            <span className="text-stone-300 font-mono text-xs">-</span>
                          )}
                        </td>
                                        <td className="px-6 py-4 min-w-[140px]">
                          <div className="space-y-1.5">
                            <p className="text-sm font-bold text-indigo-600">{vehicle.deliveryDate}</p>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-stone-700">Plan: {vehicle.planLoad}</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-black text-stone-400 uppercase tracking-tighter">SUB</span>
                              <span className="inline-block px-2.5 py-1 rounded-md border border-indigo-200 bg-indigo-50 text-indigo-700 text-sm font-bold uppercase tracking-wider">
                                {vehicle.sub}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 min-w-[220px]">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                                <Truck size={20} />
                              </div>
                              {vehicleQueues[vehicle.id] && (
                                <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full ${STATUS_SOLID_COLORS[vehicle.status]} text-white text-[10px] font-bold flex items-center justify-center border-2 border-white shadow-sm transition-colors duration-300`}>
                                  {vehicleQueues[vehicle.id]}
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="text-lg font-bold text-stone-900">{vehicle.vehicleNumber}</p>
                              <div className="flex items-center gap-1 text-sm text-stone-500">
                                <User size={12} />
                                <span>{vehicle.driverName}</span>
                              </div>
                              <div className="flex items-center gap-1 text-xs text-stone-500">
                                <Phone size={12} />
                                <span>{vehicle.driverPhone}</span>
                              </div>
                              {vehicle.tripC && (
                                <div className="flex items-center gap-1 text-[10px] font-bold text-indigo-500 uppercase tracking-tight mt-0.5">
                                  <Hash size={10} />
                                  <span>Trip C: {vehicle.tripC}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-2 min-w-[160px]">
                            <div className="flex items-center justify-between mb-1">
                              <span className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider whitespace-pre-line text-left flex flex-col items-start justify-center ${STATUS_COLORS[vehicle.status]}`}>
                                {STATUS_LABELS[vehicle.status]}
                              </span>
                              <span className="text-base font-bold text-stone-600">{vehicle.percentage}%</span>
                            </div>
                            
                            <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${vehicle.percentage}%` }}
                                className={`h-full rounded-full ${
                                  vehicle.percentage === 100 ? 'bg-emerald-500' : 
                                  vehicle.percentage > 0 ? 'bg-indigo-500' : 'bg-stone-300'
                                }`}
                              />
                            </div>

                            {(() => {
                              const delayStatus = getDelayStatus(vehicle.deliveryDate, vehicle.planLoad, vehicle.checkIn);
                              if (!delayStatus) return null;
                              return delayStatus.status === 'Delay' ? (
                                <span className="px-2 py-1 rounded-md text-[10px] font-bold bg-red-100 text-red-600 whitespace-nowrap w-fit">
                                  DELAY {delayStatus.mins}m
                                </span>
                              ) : (
                                <span className="px-2 py-1 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-600 whitespace-nowrap w-fit">
                                  ON TIME
                                </span>
                              );
                            })()}
                          </div>
                        </td>
                        <td className="px-6 py-4 min-w-[120px]">
                          <div className="text-xs space-y-1 font-mono text-stone-500 whitespace-nowrap">
                            {vehicle.checkIn && <p>CIN: {new Date(vehicle.checkIn).toLocaleTimeString()}</p>}
                            {vehicle.invoiceReceiving && <p>DOC: {new Date(vehicle.invoiceReceiving).toLocaleTimeString()}</p>}
                            {vehicle.checking && <p>CHK: {new Date(vehicle.checking).toLocaleTimeString()}</p>}
                            {vehicle.handover && <p>LOD: {new Date(vehicle.handover).toLocaleTimeString()}</p>}
                            {vehicle.checkOut && <p>OUT: {new Date(vehicle.checkOut).toLocaleTimeString()}</p>}
                            {vehicle.totalTime && (
                              <p className="text-sm text-indigo-600 font-bold mt-1">Total: {vehicle.totalTime}</p>
                            )}
                            {vehicle.lastRevertedAt && (
                              <div className="mt-1">
                                <p className="text-[10px] text-red-400 italic">
                                  Reverted: {new Date(vehicle.lastRevertedAt).toLocaleTimeString()}
                                </p>
                                {vehicle.revertRemark && (
                                  <p className="text-[10px] text-red-500 font-bold">
                                    Reason: {vehicle.revertRemark}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex flex-col gap-2 items-end">
                            <div className="flex items-center gap-2">
                              {vehicle.status !== 'Check Out' && (
                                <button
                                  onClick={() => setEditingVehicle(vehicle)}
                                  className="p-3 text-stone-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all"
                                  title="Edit Driver Details"
                                >
                                  <Edit2 size={18} />
                                </button>
                              )}
                              {vehicle.status !== 'Waiting' && (
                                <button 
                                  onClick={() => handleStatusRevert(vehicle.id, vehicle.status)}
                                  className="p-3 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all"
                                  title="Revert Status"
                                >
                                  <RefreshCw size={18} className="rotate-180" />
                                </button>
                              )}
                              {vehicle.status !== 'Check Out' ? (
                                <button 
                                  onClick={() => handleStatusUpdate(vehicle.id, vehicle.status)}
                                  className="group flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-base font-bold transition-all shadow-md hover:shadow-lg active:scale-95"
                                >
                                  <span>{STATUS_FLOW[STATUS_FLOW.indexOf(vehicle.status) + 1]}</span>
                                  <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                                </button>
                              ) : (
                                <div className="flex items-center gap-1 text-emerald-600 font-bold text-sm px-4 py-3">
                                  <CheckCircle2 size={16} />
                                  <span>Completed</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                )}
              </tbody>
            </table>
          </div>
          {filteredVehicles.length === 0 && (
            <div className="py-20 text-center">
              <div className="bg-stone-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-stone-300">
                <Search size={32} />
              </div>
              <p className="text-stone-500 font-medium">No vehicles found matching your criteria</p>
            </div>
          )}
        </div>
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
                                  handleFirestoreError(error, OperationType.UPDATE, 'vehicles');
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
                          <div className="bg-white p-3 rounded-xl shadow-sm border border-stone-100">
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
                                handleFirestoreError(error, OperationType.UPDATE, 'vehicles');
                              }
                            }}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                            title="Restore"
                          >
                            <RefreshCw size={16} />
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
            if (v.checkIn) activities.push({ vehicleNumber: v.vehicleNumber, driverName: v.driverName, trip: v.trip, sub: v.sub, status: 'Check In' as Status, time: new Date(v.checkIn).getTime(), timeString: v.checkIn });
            if (v.invoiceReceiving) activities.push({ vehicleNumber: v.vehicleNumber, driverName: v.driverName, trip: v.trip, sub: v.sub, status: 'Invoice Receiving' as Status, time: new Date(v.invoiceReceiving).getTime(), timeString: v.invoiceReceiving });
            if (v.checking) activities.push({ vehicleNumber: v.vehicleNumber, driverName: v.driverName, trip: v.trip, sub: v.sub, status: 'Checking' as Status, time: new Date(v.checking).getTime(), timeString: v.checking });
            if (v.handover) activities.push({ vehicleNumber: v.vehicleNumber, driverName: v.driverName, trip: v.trip, sub: v.sub, status: 'Handover' as Status, time: new Date(v.handover).getTime(), timeString: v.handover });
            if (v.checkOut) activities.push({ vehicleNumber: v.vehicleNumber, driverName: v.driverName, trip: v.trip, sub: v.sub, status: 'Check Out' as Status, time: new Date(v.checkOut).getTime(), timeString: v.checkOut });
            return activities;
          }).sort((a, b) => b.time - a.time).slice(0, 20);

          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-stone-50 text-stone-900 h-screen overflow-hidden font-sans flex flex-col"
            >
              {/* Dashboard Header */}
              <header className="px-8 py-4 bg-white border-b border-stone-200 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-5">
                  <div className="bg-indigo-600 w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                    <LayoutDashboard size={24} />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold tracking-tight text-stone-900">Vehicle Loading Tracker Dashboard</h1>
                    <div className="flex flex-col gap-1 mt-1">
                      <div className="flex items-center gap-2 text-stone-500 text-sm font-medium">
                        <Calendar size={14} />
                        {latestDate || 'No Data'}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-stone-400 text-xs font-bold">
                          Last Updated: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <div className="flex items-center gap-1.5 bg-emerald-500 text-white px-2 py-0.5 rounded text-[9px] font-black tracking-widest shadow-sm">
                          <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                          ONLINE
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <RecentActivityTicker activities={recentActivities}>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="flex items-center gap-2 bg-white border border-stone-200 px-2 py-1 rounded-lg">
                      <Filter size={14} className="text-stone-400" />
                      <select 
                        className="bg-transparent border-none text-xs font-bold focus:ring-0 pr-6 py-0"
                        value={dashboardPlanFilter}
                        onChange={(e) => setDashboardPlanFilter(e.target.value)}
                      >
                        <option value="All">All Planloads</option>
                        {(() => {
                          const plans = [...new Set(latestVehicles.map(v => (v.planLoad || '').trim()).filter(Boolean))].sort(sortPlanLoad);
                          return plans.map(p => <option key={p} value={p}>{p}</option>);
                        })()}
                      </select>
                    </div>
                    <button 
                      onClick={() => setIsFullScreenSummary(false)}
                      className="bg-stone-900 hover:bg-stone-800 text-white px-5 py-2 rounded-xl transition-all flex items-center gap-2 font-bold text-sm shadow-lg shadow-stone-200 active:scale-95"
                    >
                      <Minimize size={16} />
                      Exit Dashboard
                    </button>
                  </div>
                </RecentActivityTicker>
              </header>

              <main className="flex-1 p-6 overflow-hidden">
                {(() => {
                  const total = latestVehicles.length;
                const completed = latestVehicles.filter(v => v.status === 'Check Out').length;
                const inProgress = latestVehicles.filter(v => v.status !== 'Waiting' && v.status !== 'Check Out').length;
                const waiting = latestVehicles.filter(v => v.status === 'Waiting').length;

                const planGroups = [...new Set(latestVehicles.map(v => v.planLoad))].sort(sortPlanLoad);
                const handOverProgress = planGroups.map(plan => {
                  const roundVehicles = latestVehicles.filter(v => v.planLoad === plan);
                  const trips = roundVehicles.length;
                  const checkIn = roundVehicles.filter(v => v.status !== 'Waiting').length;
                  const completed = roundVehicles.filter(v => v.status === 'Check Out').length;
                  const startHandover = checkIn - completed;
                  const percentage = trips > 0 ? (completed / trips) * 100 : 0;
                  return { plan, trips, checkIn, startHandover, completed, percentage };
                });

                const combinedProgress = planGroups.map(plan => {
                  const roundVehicles = latestVehicles.filter(v => v.planLoad === plan);
                  const roundTotal = roundVehicles.length;
                  const statuses = STATUS_FLOW.map(status => {
                    const count = roundVehicles.filter(v => v.status === status).length;
                    return {
                      status,
                      count,
                      percentage: roundTotal > 0 ? (count / roundTotal) * 100 : 0,
                      color: STATUS_HEX_COLORS[status]
                    };
                  }).filter(s => s.count > 0);

                  return { plan, total: roundTotal, statuses };
                });

                return (
                  <div className="grid grid-cols-12 gap-6 h-full">
                    {/* Left Panel: Metrics & Distribution */}
                    <aside className="col-span-12 lg:col-span-3 flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-2">
                      {/* Overview Stats & Efficiency */}
                      <section className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm shrink-0 h-[130px] flex flex-col">
                        <AnimatePresence mode="wait">
                          {metricsView === 'overview' ? (
                            <motion.div
                              key="overview"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="flex-1 flex flex-col"
                            >
                              <h2 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <LayoutDashboard size={12} className="text-indigo-500" />
                                Today's Overview
                              </h2>
                              <div className="grid grid-cols-4 gap-2 flex-1">
                                {[
                                  { label: 'Total', value: total, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                                  { label: 'Wait', value: waiting, color: 'text-stone-500', bg: 'bg-stone-50' },
                                  { label: 'Active', value: inProgress, color: 'text-amber-600', bg: 'bg-amber-50' },
                                  { label: 'Done', value: completed, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                                ].map((s, i) => (
                                  <div key={i} className={`${s.bg} p-2 rounded-xl border border-white/50 flex flex-col items-center justify-center text-center`}>
                                    <p className={`text-xl font-black ${s.color} leading-none mb-1`}>{s.value}</p>
                                    <p className="text-[9px] font-bold text-stone-500 uppercase tracking-wider">{s.label}</p>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          ) : (
                            <motion.div
                              key="efficiency"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="flex-1 flex flex-col"
                            >
                              <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <BarChart3 size={12} className="text-indigo-500" />
                                Efficiency Metrics
                              </h3>
                              {(() => {
                                const completedVehicles = latestVehicles.filter(v => v.status === 'Check Out');
                                const avgTime = completedVehicles.length > 0 
                                  ? (completedVehicles.reduce((acc, v) => {
                                      const [h, m] = (v.totalTime || '0h 0m').split(' ').map(s => parseInt(s));
                                      return acc + (h * 60 + (m || 0));
                                    }, 0) / completedVehicles.length).toFixed(0)
                                  : 0;

                                return (
                                  <div className="grid grid-cols-4 gap-2 flex-1">
                                    <div className="bg-stone-900 p-2.5 rounded-xl text-white relative overflow-hidden group flex flex-col justify-center border border-white/5">
                                      <div className="absolute -right-1 -bottom-1 opacity-10 group-hover:scale-110 transition-transform">
                                        <Clock size={32} />
                                      </div>
                                      <p className="text-xl font-black leading-none mb-1">{avgTime}</p>
                                      <p className="text-[8px] font-bold text-stone-400 uppercase tracking-wider">Avg Mins</p>
                                    </div>
                                    <div className="bg-indigo-600 p-2.5 rounded-xl text-white relative overflow-hidden group flex flex-col justify-center border border-white/5">
                                      <div className="absolute -right-1 -bottom-1 opacity-10 group-hover:scale-110 transition-transform">
                                        <CheckCircle2 size={32} />
                                      </div>
                                      <p className="text-xl font-black leading-none mb-1">{completed}</p>
                                      <p className="text-[8px] font-bold text-indigo-200 uppercase tracking-wider">Handled</p>
                                    </div>
                                    <div className="bg-emerald-500 p-2.5 rounded-xl text-white relative overflow-hidden group flex flex-col justify-center border border-white/5">
                                      <div className="absolute -right-1 -bottom-1 opacity-10 group-hover:scale-110 transition-transform">
                                        <CheckCircle2 size={32} />
                                      </div>
                                      <p className="text-xl font-black leading-none mb-1">
                                        {latestVehicles.filter(v => v.status !== 'Waiting' && getDelayStatus(v.deliveryDate, v.planLoad, v.checkIn)?.status === 'On Time').length}
                                      </p>
                                      <p className="text-[8px] font-bold text-emerald-100 uppercase tracking-wider">On Time</p>
                                    </div>
                                    <div className="bg-red-500 p-2.5 rounded-xl text-white relative overflow-hidden group flex flex-col justify-center border border-white/5">
                                      <div className="absolute -right-1 -bottom-1 opacity-10 group-hover:scale-110 transition-transform">
                                        <AlertCircle size={32} />
                                      </div>
                                      <p className="text-xl font-black leading-none mb-1">
                                        {latestVehicles.filter(v => v.status !== 'Waiting' && getDelayStatus(v.deliveryDate, v.planLoad, v.checkIn)?.status === 'Delay').length}
                                      </p>
                                      <p className="text-[8px] font-bold text-red-100 uppercase tracking-wider">Delayed</p>
                                    </div>
                                  </div>
                                );
                              })()}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </section>

                      {/* Combined Progress */}
                      <section className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm flex-1 min-h-[320px] flex flex-col overflow-hidden">
                        <div className="flex-1 flex flex-col overflow-hidden">
                          <h2 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4 flex items-center justify-between">
                            Progress by Planload & Status
                            <BarChart3 size={14} className="text-indigo-500" />
                          </h2>

                          {/* Legend */}
                          <div className="flex flex-wrap gap-2 mb-4">
                            {STATUS_FLOW.map(status => (
                              <div key={status} className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_HEX_COLORS[status] }} />
                                <span className="text-[9px] font-bold text-stone-500 uppercase">{STATUS_LABELS[status].replace('\n', ' ')}</span>
                              </div>
                            ))}
                          </div>

                          <div id="progress-scroll-container" className="space-y-6 overflow-y-auto pr-2 custom-scrollbar flex-1">
                            {combinedProgress.map((cp, i) => (
                              <div key={i} className="group">
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-sm font-bold text-stone-900">{cp.plan}</span>
                                  <span className="text-xs font-bold text-stone-500">{cp.total} Vehicles</span>
                                </div>
                                
                                {/* Stacked Bar */}
                                <div className="h-2.5 w-full bg-stone-100 rounded-full overflow-hidden flex">
                                  {cp.statuses.map((s, idx) => (
                                    <motion.div 
                                      key={s.status}
                                      initial={{ width: 0 }}
                                      animate={{ width: `${s.percentage}%` }}
                                      className="h-full transition-all duration-1000 border-r border-white/20 last:border-0"
                                      style={{ backgroundColor: s.color }}
                                      title={`${STATUS_LABELS[s.status].replace('\n', ' ')}: ${s.count}`}
                                    />
                                  ))}
                                </div>

                                {/* Detail Text */}
                                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                                  {cp.statuses.map(s => (
                                    <div key={s.status} className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: s.color }}>
                                      <span>{STATUS_LABELS[s.status].split('\n')[0]}:</span>
                                      <span>{s.count}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </section>
                    </aside>

                    {/* Main Panel: Live Queue */}
                    <main className="col-span-12 lg:col-span-9 flex flex-col overflow-hidden">
                      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm flex-1 flex flex-col overflow-hidden">
                        {/* Panel Header */}
                        <div className="px-8 py-6 border-b border-stone-100 flex items-center justify-between shrink-0 bg-stone-50/30 relative overflow-hidden">
                          {/* Scanning Effect */}
                          <motion.div 
                            animate={{ 
                              top: ["-100%", "200%"],
                              opacity: [0, 0.3, 0]
                            }}
                            transition={{ 
                              duration: 4, 
                              repeat: Infinity, 
                              ease: "linear" 
                            }}
                            className="absolute left-0 right-0 h-20 bg-gradient-to-b from-transparent via-indigo-500/10 to-transparent pointer-events-none z-0"
                          />
                          
                          <div className="flex items-center gap-4 relative z-10">
                            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-100">
                              <Truck size={20} />
                            </div>
                            <div>
                              <div className="flex items-center gap-3">
                                <h2 className="text-xl font-bold text-stone-900 tracking-tight">Live Queue Status</h2>
                                <div className="flex items-center gap-1.5 bg-red-600 text-white px-2.5 py-1 rounded-lg text-[10px] font-black tracking-widest shadow-sm">
                                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                  LIVE
                                </div>
                              </div>
                              <p className="text-xs font-medium text-stone-500">Real-time vehicle tracking and status updates</p>
                            </div>
                          </div>

                          {/* Round Time in Header */}
                          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center">
                            {(() => {
                              const activePlanGroups = [...new Set(latestVehicles.map(v => v.planLoad))].sort(sortPlanLoad);
                              const safeIndex = currentRoundIndex % activePlanGroups.length;
                              const currentPlan = activePlanGroups[safeIndex];
                              return currentPlan ? (
                                <>
                                  <span className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-[-8px]">Plan Load</span>
                                  <motion.div
                                    key={currentPlan}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-5xl font-black text-indigo-600 tracking-tighter drop-shadow-sm"
                                  >
                                    {currentPlan}
                                  </motion.div>
                                </>
                              ) : null;
                            })()}
                          </div>

                          <div className="flex items-center gap-6">
                            {(() => {
                              const activePlanGroups = [...new Set(latestVehicles.map(v => v.planLoad))].sort(sortPlanLoad);
                              if (activePlanGroups.length <= 1) return null;
                              return (
                                <div className="flex items-center gap-1.5">
                                  {activePlanGroups.map((_, idx) => (
                                    <div 
                                      key={idx} 
                                      className={`h-1.5 rounded-full transition-all duration-500 ${idx === currentRoundIndex ? 'w-8 bg-indigo-600' : 'w-1.5 bg-stone-200'}`} 
                                    />
                                  ))}
                                </div>
                              );
                            })()}
                            <div className="h-8 w-px bg-stone-200" />
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2 text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                                <motion.div 
                                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                                  transition={{ duration: 2, repeat: Infinity }}
                                  className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" 
                                />
                                Active
                              </div>
                              <div className="flex items-center gap-2 text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                Completed
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Panel Content */}
                        <div ref={dashboardScrollRef} className="flex-1 overflow-y-auto p-8 custom-scrollbar">
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
                                    className="h-full flex flex-col items-center justify-center text-stone-300 space-y-6 py-20"
                                  >
                                    <div className="w-24 h-24 bg-stone-100 rounded-full flex items-center justify-center text-stone-300">
                                      <Truck size={48} strokeWidth={1.5} />
                                    </div>
                                    <p className="text-xl font-bold uppercase tracking-widest">No Active Data</p>
                                  </motion.div>
                                );
                              }

                              const safeIndex = currentRoundIndex % activePlanGroups.length;
                              const plan = activePlanGroups[safeIndex];

                              return (
                                <motion.div 
                                  key={plan}
                                  initial={{ opacity: 0, x: 20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: -20 }}
                                  transition={{ duration: 0.5, ease: "easeInOut" }}
                                  className="space-y-8"
                                >
                                  <div className="flex items-center gap-4">
                                    <div className="h-px flex-1 bg-stone-100" />
                                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest bg-stone-50 px-3 py-1 rounded-full border border-stone-100">
                                      {latestVehicles.filter(v => v.planLoad === plan).length} Vehicles Total
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                    {latestVehicles
                                      .filter(v => v.planLoad === plan)
                                      .sort((a, b) => (vehicleQueues[a.id] || 999) - (vehicleQueues[b.id] || 999))
                                      .map((v) => {
                                        const isCheckOut = v.status === 'Check Out';
                                        return (
                                          <motion.div 
                                            key={v.id} 
                                            layout
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className={`group relative bg-white p-5 rounded-2xl border transition-all duration-300 ${isCheckOut ? 'border-emerald-100 bg-emerald-50/20' : 'border-stone-200 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-500/5'}`}
                                          >
                                            <div className="flex items-start justify-between mb-4">
                                              <div className="flex items-center gap-4">
                                                <div className={`w-14 h-14 rounded-xl ${STATUS_SOLID_COLORS[v.status]} text-white flex items-center justify-center text-2xl font-black shadow-lg shadow-black/5`}>
                                                  {vehicleQueues[v.id] || '-'}
                                                </div>
                                                <div>
                                                  <h4 className="text-xl font-black text-stone-900 tracking-tight leading-none mb-1">{v.vehicleNumber}</h4>
                                                  <p className="text-xs font-bold text-stone-400 uppercase tracking-wider truncate max-w-[120px] mb-0.5">{v.driverName}</p>
                                                  <p className="text-sm font-black text-indigo-600 uppercase tracking-widest mb-1.5">{v.tripC || '-'}</p>
                                                  <div className={`inline-block px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider whitespace-pre-line text-left leading-tight ${STATUS_COLORS[v.status]}`}>
                                                    {STATUS_LABELS[v.status]}
                                                  </div>
                                                </div>
                                              </div>
                                              <div className="text-right flex flex-col items-end">
                                                <p className="text-xs font-black text-indigo-600 uppercase tracking-widest leading-none mb-1.5">SUB</p>
                                                <p className="px-2.5 py-1 rounded-lg border border-indigo-200 bg-indigo-50 text-sm font-bold text-stone-900 truncate max-w-[100px]">{v.sub || '-'}</p>
                                              </div>
                                            </div>

                                            <div className="flex items-center justify-between pt-4 border-t border-stone-100">
                                              <div className="flex items-center gap-2 text-stone-400">
                                                <Clock size={14} />
                                                <span className="text-sm font-bold">
                                                  Last Updated: {v.invoiceReceiving ? new Date(v.invoiceReceiving).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                                </span>
                                              </div>
                                              <div className="flex flex-col items-end gap-1.5">
                                                {isCheckOut ? (
                                                  <div className="flex items-center gap-1.5">
                                                    <motion.div 
                                                      animate={{ 
                                                        scale: [1, 1.3, 1],
                                                        opacity: [0.6, 1, 0.6]
                                                      }}
                                                      transition={{ duration: 2, repeat: Infinity }}
                                                      className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" 
                                                    />
                                                    <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">Completed</span>
                                                  </div>
                                                ) : (
                                                  <div className="flex items-center gap-1.5">
                                                    <motion.div 
                                                      animate={{ 
                                                        scale: [1, 1.3, 1],
                                                        opacity: [0.6, 1, 0.6]
                                                      }}
                                                      transition={{ duration: 2, repeat: Infinity }}
                                                      className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.6)]" 
                                                    />
                                                    <span className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest">Active</span>
                                                  </div>
                                                )}
                                                {(() => {
                                                  const delayStatus = getDelayStatus(v.deliveryDate, v.planLoad, v.checkIn);
                                                  if (!delayStatus) return null;
                                                  return delayStatus.status === 'Delay' ? (
                                                    <span className="px-2 py-1 rounded-md text-[9px] font-bold bg-red-100 text-red-600 whitespace-nowrap">
                                                      DELAY {delayStatus.mins}m
                                                    </span>
                                                  ) : (
                                                    <span className="px-2 py-1 rounded-md text-[9px] font-bold bg-emerald-100 text-emerald-600 whitespace-nowrap">
                                                      ON TIME
                                                    </span>
                                                  );
                                                })()}
                                              </div>
                                            </div>
                                          </motion.div>
                                        );
                                      })}
                                  </div>
                                </motion.div>
                              );
                            })()}
                          </AnimatePresence>
                        </div>
                      </div>
                    </main>
                  </div>
                );
              })()}
            </main>
          </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
