
import React from 'react';

interface StatusIndicatorProps {
  isSupported: boolean;
  isActive: boolean;
  error: string | null;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ isSupported, isActive, error }) => {
  let statusText = 'Inactive';
  let colorClass = 'bg-slate-500';

  if (error) {
    statusText = 'Error';
    colorClass = 'bg-orange-500 animate-pulse';
  } else if (!isSupported) {
    statusText = 'Not Supported';
    colorClass = 'bg-red-500';
  } else if (isActive) {
    statusText = 'Active';
    colorClass = 'bg-green-500 animate-pulse';
  }

  return (
    <div className="flex items-center justify-center space-x-2 bg-slate-700/50 rounded-full px-4 py-2">
      <span className={`w-3 h-3 rounded-full ${colorClass}`}></span>
      <span className="text-sm font-medium text-slate-300">Status: {statusText}</span>
    </div>
  );
};
