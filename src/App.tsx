import { useState } from 'react';
import { MapViewer } from './components/MapViewer';
import { TimelineControl } from './components/TimelineControl';
import { Legend } from './components/Legend';
import { InfoPanel } from './components/InfoPanel';
import { configureDataSource } from './lib/no2Data';

configureDataSource({
    mode: 'geotiff',
    geotiffBaseUrl: '/data',
    baselineGeotiffUrl: '/data/baseline.tif'
    // citiesDataUrl omitted - will use default MAJOR_GERMAN_CITIES
  });

export default function App() {
  const [currentDate, setCurrentDate] = useState<Date>(new Date('2020-01-01'));
  const [selectedCity, setSelectedCity] = useState<any>(null);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-100">
      <MapViewer 
        currentDate={currentDate}
        onCitySelect={setSelectedCity}
      />
      <TimelineControl
        currentDate={currentDate}
        onDateChange={setCurrentDate}
      />
      <Legend />
      <InfoPanel 
        selectedCity={selectedCity} 
        currentDate={currentDate}
        onClose={() => setSelectedCity(null)}
      />
    </div>
  );
}