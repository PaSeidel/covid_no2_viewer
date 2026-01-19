import { useState, useEffect } from 'react';
import { TrendingDown, TrendingUp, AlertCircle, X } from 'lucide-react';
import { getCityDataAsync } from '../lib/no2Data';

interface InfoPanelProps {
  selectedCity: any;
  currentDate: Date;
  onClose: () => void;
}

export function InfoPanel({ selectedCity, currentDate, onClose }: InfoPanelProps) {
  const [cityData, setCityData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedCity) {
      setCityData(null);
      return;
    }

    setLoading(true);
    getCityDataAsync(selectedCity.name, currentDate)
      .then(data => {
        setCityData(data);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error loading city data:', error);
        setLoading(false);
      });
  }, [selectedCity, currentDate]);

  if (!selectedCity) return null;
  if (loading) return <div>Loading...</div>;
  if (!cityData) return null;

  const { baseline, current, difference, percentageChange, isSignificant } = cityData;

  const isDecrease = difference < 0;
  const absPercentage = Math.abs(percentageChange);

  return (
    <div className="absolute top-6 right-6 bg-white rounded-lg shadow-xl p-6 w-96">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-sm text-gray-500">Selected City</h3>
          <h2 className="mt-1">{selectedCity.name}</h2>
        </div>
        <div className="flex items-center gap-2">
          {isSignificant && (
            <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
              <AlertCircle className="w-3 h-3" />
              <span>Significant</span>
            </div>
          )}
          <button 
            className="text-gray-400 hover:text-gray-600 transition-colors" 
            onClick={onClose}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Current vs Baseline */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500">Baseline (2019)</p>
            <p className="mt-1 text-xl">{baseline.value.toFixed(6)}</p>
            <p className="text-xs text-gray-500">mol/m²</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500">Current</p>
            <p className="mt-1 text-xl">{current.value.toFixed(6)}</p>
            <p className="text-xs text-gray-500">mol/m²</p>
          </div>
        </div>

        {/* Change indicator */}
        <div className={`p-4 rounded-lg ${isDecrease ? 'bg-green-50' : 'bg-orange-50'}`}>
          <div className="flex items-center gap-2 mb-2">
            {isDecrease ? (
              <TrendingDown className="w-5 h-5 text-green-600" />
            ) : (
              <TrendingUp className="w-5 h-5 text-orange-600" />
            )}
            <span className={`${isDecrease ? 'text-green-900' : 'text-orange-900'}`}>
              {isDecrease ? 'Decrease' : 'Increase'} from baseline
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl ${isDecrease ? 'text-green-600' : 'text-orange-600'}`}>
              {difference > 0 ? '+' : ''}{difference.toFixed(6)}
            </span>
            <span className="text-sm text-gray-600">mol/m²</span>
          </div>
          <div className={`text-sm mt-1 ${isDecrease ? 'text-green-700' : 'text-orange-700'}`}>
            {percentageChange > 0 ? '+' : ''}{percentageChange.toFixed(1)}% change
          </div>
        </div>

        {/* Statistical significance explanation */}
        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-start gap-2 text-sm text-gray-600">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>
              {isSignificant ? (
                <>
                  The change is <strong>statistically significant</strong> (p &lt; 0.05).
                </>
              ) : (
                <>
                  The change is <strong>not statistically significant</strong> (p ≥ 0.05).
                </>
              )}
            </p>
          </div>
        </div>

        {/* Coordinates */}
        <div className="pt-4 border-t border-gray-200 text-xs text-gray-500">
          <p>Coordinates: {selectedCity.lat.toFixed(4)}°N, {selectedCity.lng.toFixed(4)}°E</p>
          <p>Population: {selectedCity.population.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}