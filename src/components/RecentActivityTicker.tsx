import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Activity, ChevronRight } from 'lucide-react';
import { STATUS_HEX_COLORS, STATUS_LABELS } from '../constants';
import { Status } from '../types';

interface ActivityItem {
  vehicleNumber: string;
  driverName: string;
  trip: string;
  sub: string;
  status: Status;
  time: number;
  timeString: string;
}

export const RecentActivityTicker = ({ activities, children }: { activities: ActivityItem[], children?: React.ReactNode }) => {
  if (activities.length === 0) return null;

  // Limit to 10 recent items
  const recent10 = activities.slice(0, 10);

  // If we have 3 or fewer items, they fit in the container without scrolling
  const needsScroll = recent10.length > 3;
  
  // Duplicate activities to create a seamless loop if scrolling is needed
  const displayActivities = needsScroll ? [...recent10, ...recent10] : recent10;
  
  // Each item is 28px tall (h-7). 3 items visible = 84px container height.
  const itemHeight = 28;
  const scrollDistance = recent10.length * itemHeight;

  // Find the latest time to highlight (by minute)
  const formatTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const latestTimeFormatted = recent10.length > 0 ? formatTime(recent10[0].timeString) : null;

  // State to manage animation
  const [isPaused, setIsPaused] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);

  // Pause animation when new items arrive
  useEffect(() => {
    if (recent10.length > 0) {
      setIsPaused(true);
      setAnimationKey(prev => prev + 1); // Reset animation
      
      const timer = setTimeout(() => {
        setIsPaused(false);
      }, 5000); // Pause for 5 seconds
      
      return () => clearTimeout(timer);
    }
  }, [recent10[0]?.timeString]); // Trigger when the most recent item changes

  return (
    <div className="flex-1 mx-6 flex items-center gap-4">
      <div className="flex-1 flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-stone-500 px-1">
          <Activity size={14} className="text-indigo-500" />
          <span className="text-[11px] font-bold uppercase tracking-widest">Recent Updates</span>
        </div>
        
        <div className="h-[84px] bg-stone-50 rounded-xl border border-stone-200 overflow-hidden relative flex items-center px-4 shadow-inner">
          <div className="relative h-full flex-1 overflow-hidden">
            <motion.div
              key={animationKey}
              animate={needsScroll && !isPaused ? { y: [0, -scrollDistance] } : { y: 0 }}
              transition={needsScroll && !isPaused ? { 
                duration: activities.length * 2, // 2s per item for readable speed
                ease: "linear",
                repeat: Infinity
              } : {}}
              className="absolute top-0 left-0 right-0 flex flex-col"
            >
              {displayActivities.map((activity, i) => {
                const timeFormatted = formatTime(activity.timeString);
                const isNew = timeFormatted === latestTimeFormatted; // Highlight all items in the same minute
                
                return (
                  <div key={i} className="flex items-center gap-2 h-7 shrink-0 text-sm">
                    <div className="flex items-center w-28 shrink-0">
                      <div className="w-10 shrink-0 flex justify-start">
                        {isNew && (
                          <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider animate-pulse">
                            New
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-stone-400 font-medium shrink-0">
                        {timeFormatted}
                      </span>
                    </div>
                    <ChevronRight size={12} className="text-stone-300 shrink-0" />
                    
                    <span className="font-black text-indigo-600 uppercase tracking-wider text-xs shrink-0 w-80 truncate" title={activity.trip || '-'}>
                      {activity.trip || '-'}
                    </span>
                    <ChevronRight size={12} className="text-stone-300 shrink-0" />
                    
                    <div className="shrink-0 w-10 flex justify-center">
                      <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] font-black">
                        {activity.sub || '-'}
                      </span>
                    </div>
                    <ChevronRight size={12} className="text-stone-300 shrink-0" />
                    
                    <span className="font-medium text-stone-600 text-xs shrink-0 w-40 truncate" title={activity.driverName || '-'}>
                      {activity.driverName || '-'}
                    </span>
                    <ChevronRight size={12} className="text-stone-300 shrink-0" />
                    
                    <span className="font-black text-stone-800 text-xs shrink-0 w-28 truncate" title={activity.vehicleNumber || '-'}>
                      {activity.vehicleNumber || '-'}
                    </span>
                    <ChevronRight size={12} className="text-stone-300 shrink-0" />
                    
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: STATUS_HEX_COLORS[activity.status] || '#d6d3d1' }} />
                      <span className="text-[11px] font-bold uppercase tracking-wider truncate" style={{ color: STATUS_HEX_COLORS[activity.status] }}>
                        {STATUS_LABELS[activity.status].replace('\n', ' ')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </motion.div>
          </div>
        </div>
      </div>
      {children && (
        <div className="shrink-0 flex items-center gap-2">
          {children}
        </div>
      )}
    </div>
  );
};
