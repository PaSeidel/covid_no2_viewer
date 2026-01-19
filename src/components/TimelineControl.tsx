import { Play, Pause } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

interface TimelineControlProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
}

const START_DATE = new Date('2020-01-01');
const END_DATE = new Date('2024-12-01');

export function TimelineControl({ currentDate, onDateChange }: TimelineControlProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const intervalRef = useRef<number | null>(null);

  // Convert date to slider value (months since start)
  const dateToValue = (date: Date): number => {
    const months = (date.getFullYear() - START_DATE.getFullYear()) * 12 + 
                   (date.getMonth() - START_DATE.getMonth());
    return months;
  };

  // Convert slider value to date
  const valueToDate = (value: number): Date => {
    const date = new Date(START_DATE);
    date.setMonth(date.getMonth() + value);
    return date;
  };

  const maxValue = dateToValue(END_DATE);
  const currentValue = dateToValue(currentDate);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    onDateChange(valueToDate(value));
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  // Auto-advance timeline when playing
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = window.setInterval(() => {
        onDateChange(prev => {
          const nextValue = dateToValue(prev) + 1;
          if (nextValue > maxValue) {
            setIsPlaying(false);
            return prev;
          }
          return valueToDate(nextValue);
        });
      }, 500); // Advance every 500ms
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, maxValue, onDateChange]);

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long'
    });
  };

  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white rounded-lg shadow-xl p-6 w-[600px]">
      <div className="flex items-center gap-4">
        <button
          onClick={handlePlayPause}
          className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-colors"
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </button>

        <div className="flex-1">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">Timeline</span>
            <span className="font-medium">{formatDate(currentDate)}</span>
          </div>
          
          <input
            type="range"
            min="0"
            max={maxValue}
            value={currentValue}
            onChange={handleSliderChange}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
            style={{
              background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(currentValue / maxValue) * 100}%, #e5e7eb ${(currentValue / maxValue) * 100}%, #e5e7eb 100%)`
            }}
          />
          
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{formatDate(START_DATE)}</span>
            <span>{formatDate(END_DATE)}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Baseline: 2017-2019 average</span>
          <span className="text-gray-600">Showing difference from baseline</span>
        </div>
      </div>
    </div>
  );
}
