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
  
  // No longer duplicating activities for seamless loop as per user request "ไม่วน"
  const displayActivities = recent10;
  
  // Each item is 32px tall (h-8). 3 items visible = 96px container height.
  const itemHeight = 32;
  const visibleCount = 3;
  // Scroll distance is the total height minus the visible area
  const scrollDistance = Math.max(0, (recent10.length - visibleCount) * itemHeight);

  // Find the latest time to highlight (by minute)
  const formatTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const latestTimeFormatted = recent10.length > 0 ? formatTime(recent10[0].timeString) : null;

  // State to manage animation
  const [isPaused, setIsPaused] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  const [showAlert, setShowAlert] = useState(false);

  // Trigger alert and pause animation when new items arrive
  useEffect(() => {
    if (recent10.length > 0) {
      setIsPaused(true);
      setShowAlert(true);
      setAnimationKey(prev => prev + 1); // Reset animation to top
      
      // Border animation takes 6 seconds
      const alertDuration = 6000;
      const pauseAfterAlert = 5000;
      
      const alertTimer = setTimeout(() => {
        setShowAlert(false);
      }, alertDuration);
      
      const pauseTimer = setTimeout(() => {
        setIsPaused(false);
      }, alertDuration + pauseAfterAlert);
      
      return () => {
        clearTimeout(alertTimer);
        clearTimeout(pauseTimer);
      };
    }
  }, [recent10[0]?.timeString]); // Trigger when the most recent item changes

  const scrollDuration = recent10.length * 2.5;
  const pauseDuration = 5;
  const totalDuration = scrollDuration + pauseDuration;

  return (
    <div className="flex-1 mx-8 flex items-center gap-6">
      <div className="flex-1 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-stone-500 px-1">
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md transition-colors duration-500 ${showAlert ? 'bg-red-50 text-red-600 shadow-[0_0_10px_rgba(239,68,68,0.1)]' : 'bg-indigo-50 text-indigo-600'}`}>
            <Activity size={12} className={showAlert ? "animate-bounce" : "animate-pulse"} />
            <span className="text-[10px] font-black uppercase tracking-widest">Live Feed</span>
          </div>
          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Recent Updates</span>
        </div>
        
        <div className="h-[96px] bg-white rounded-2xl border border-stone-200 overflow-hidden relative shadow-sm">
          {/* Red Alert Graphic - Subtle Glowing Border */}
          {showAlert && (
            <div className="absolute inset-0 pointer-events-none z-20">
              <svg className="absolute inset-0 w-full h-full rounded-2xl overflow-visible">
                <defs>
                  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>
                <motion.rect
                  x="1" y="1" width="calc(100% - 2px)" height="calc(100% - 2px)"
                  rx="15" fill="none"
                  stroke="#ef4444" strokeWidth="1.5"
                  strokeOpacity="0.4"
                  strokeDasharray="80 300"
                  filter="url(#glow)"
                  animate={{ strokeDashoffset: [0, -1000] }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                />
              </svg>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.04, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 bg-red-500 rounded-2xl"
              />
            </div>
          )}

          <div className="relative h-full flex-1 overflow-hidden">
            <motion.div
              key={animationKey}
              initial={{ y: 0 }}
              animate={needsScroll && !isPaused ? { y: [0, 0, -scrollDistance] } : { y: 0 }}
              transition={needsScroll && !isPaused ? { 
                duration: totalDuration, 
                times: [0, pauseDuration / totalDuration, 1],
                ease: "linear",
                repeat: Infinity
              } : {}}
              className="absolute top-0 left-0 right-0 flex flex-col"
            >
              {displayActivities.map((activity, i) => {
                const timeFormatted = formatTime(activity.timeString);
                const isNew = timeFormatted === latestTimeFormatted;
                
                return (
                  <div key={i} className="flex items-center gap-4 h-8 shrink-0 px-6 border-b border-stone-50 last:border-0 hover:bg-stone-50 transition-colors">
                    {/* NEW Badge & Time */}
                    <div className="flex items-center gap-3 w-32 shrink-0">
                      <div className="w-10 shrink-0">
                        {isNew && (
                          <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tighter shadow-sm animate-pulse">
                            NEW
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-stone-400 font-black tabular-nums">
                        {timeFormatted}
                      </span>
                    </div>
                    
                    {/* Vehicle & Driver (The core identity) */}
                    <div className="flex items-center gap-3 w-64 shrink-0">
                      <span className="font-black text-stone-900 text-sm truncate min-w-[80px]">
                        {activity.vehicleNumber}
                      </span>
                      <span className="text-xs font-bold text-stone-400 uppercase tracking-tight truncate opacity-80">
                        {activity.driverName}
                      </span>
                    </div>

                    {/* Sub | Trip (Context) */}
                    <div className="flex-1 min-w-0 flex items-center">
                      <div className="inline-flex items-center gap-1.5 bg-stone-100/50 px-2 py-0.5 rounded-md border border-stone-200/50 max-w-full">
                        <span className="text-[10px] font-black text-indigo-600 uppercase shrink-0">{activity.sub}</span>
                        <span className="text-[10px] font-bold text-stone-300 shrink-0">|</span>
                        <span className="text-[10px] font-black text-stone-600 uppercase truncate">{activity.trip}</span>
                      </div>
                    </div>

                    {/* Status (Right aligned) */}
                    <div className="flex items-center gap-2 shrink-0 min-w-[140px] justify-end">
                      <div className="w-1.5 h-1.5 rounded-full shadow-sm" style={{ backgroundColor: STATUS_HEX_COLORS[activity.status] || '#d6d3d1' }} />
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap leading-none" style={{ color: STATUS_HEX_COLORS[activity.status] }}>
                          {STATUS_LABELS[activity.status]}
                        </span>
                        <span className="text-[8px] font-bold opacity-60 whitespace-nowrap leading-none mt-0.5" style={{ color: STATUS_HEX_COLORS[activity.status] }}>
                          {STATUS_LABELS[activity.status]}
                        </span>
                      </div>
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
