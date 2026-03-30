import React from 'react';
import { VehicleRecord } from './types';
import { User as FirebaseUser } from 'firebase/auth';
import { MonitorContent } from './components/MonitorContent';

interface MonitorProps {
  mode: 'tv' | 'mobile';
  vehicles: VehicleRecord[];
}

export const Monitor: React.FC<MonitorProps> = ({ mode, vehicles }) => {
  return <MonitorContent vehicles={vehicles} mode={mode} />;
};
