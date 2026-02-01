import { GeoTIFFDataSource } from './geotiffDataSource';

export interface City {
  name: string;
  lat: number;
  lng: number;
  population: number;
}
export interface CityTimepoint {
  cityName: string;
  timestamp: Date;
  value: number; // NO2 concentration in mol/m²
  incidence: number; // COVID-19 incidence rate
  pValue: number; // p-value for statistical significance
}

export interface GridPoint {
  lat: number;
  lng: number;
  value: number;
  difference: number;
}

// Data source configuration
export interface DataSourceConfig {
  mode: 'geotiff';
  geotiffBaseUrl?: string; // Base URL for GeoTIFF files
  baselineGeotiffUrl?: string; // URL for baseline GeoTIFF
  citiesDataUrl?: string; // URL for cities JSON data
}

// Default configuration
let dataSourceConfig: DataSourceConfig = {
    mode: 'geotiff',
    geotiffBaseUrl: '/data',
    citiesDataUrl: '/city_data'
  }

// Singleton GeoTIFF data source
let geotiffDataSource: GeoTIFFDataSource | null = null;

/**
 * Get or create GeoTIFF data source
 */
function getGeoTIFFDataSource(): GeoTIFFDataSource {
  if (!geotiffDataSource) {
    geotiffDataSource = new GeoTIFFDataSource(dataSourceConfig);
    geotiffDataSource.loadCities();
  }
  return geotiffDataSource;
}

// Calculate difference from baseline
export function getMeasurementDifference(
  current: CityTimepoint,
  baseline: CityTimepoint
): number {
  return current.value - baseline.value;
}

// Calculate percentage change from baseline
export function getPercentageChange(
  current: CityTimepoint,
  baseline: CityTimepoint
): number {
  return ((current.value - baseline.value) / baseline.value) * 100;
}

/**
 * Async version of getBaselineData
 * COVID era: 2020-03 onwards, baseline is precovid average
 * Precovid: before 2020-03, baseline is 2019
 */
export async function getBaselineDataAsync(date: Date): Promise<CityTimepoint[]> {
  const source = getGeoTIFFDataSource();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const isCovid = year > 2020 || (year === 2020 && month >= 3);
  
  if (!isCovid) {
    // Precovid: baseline is 2019
    const baseline_date = new Date(date);
    baseline_date.setFullYear(2019);
    return await source.getCurrentMeasurements(baseline_date);
  }
  
  // COVID era: baseline is averaged from precovid months
  const baselineMonths = [2019]; // 2019 always
  if (month === 1) baselineMonths.push(2020);
  if (month === 2) baselineMonths.push(2020);
  
  const allMeasurements: CityTimepoint[] = [];
  for (const baselineYear of baselineMonths) {
    const baseline_date = new Date(date);
    baseline_date.setFullYear(baselineYear);
    const measurements = await source.getCurrentMeasurements(baseline_date);
    allMeasurements.push(...measurements);
  }
  
  // Average by city name
  const cityMap = new Map<string, CityTimepoint>();
  allMeasurements.forEach(m => {
    if (!cityMap.has(m.cityName)) {
      cityMap.set(m.cityName, { ...m });
    } else {
      const existing = cityMap.get(m.cityName)!;
      existing.value = (existing.value + m.value) / 2;
      existing.incidence = (existing.incidence + m.incidence) / 2;
      existing.pValue = Math.max(existing.pValue, m.pValue);
    }
  });
  
  return Array.from(cityMap.values());
}

/**
 * Async version of getCurrentMeasurements
 */
export async function getCurrentMeasurementsAsync(date: Date): Promise<CityTimepoint[]> {
  const source = getGeoTIFFDataSource();
  return await source.getCurrentMeasurements(date);
  }

/**
 * Async version of getCityData
 */
export async function getCityDataAsync(cityName: string, date: Date) {
  const baseline = await getBaselineDataAsync(date);
  const measurements = await getCurrentMeasurementsAsync(date);
  
  const baselineData = baseline.find(b => b.cityName === cityName);
  const current = measurements.find(m => m.cityName === cityName);

  console.log('getCityDataAsync', cityName, date, baselineData, current);
  
  if (!baselineData || !current) return null;
  
  return {
    baseline: baselineData,
    current,
    difference: getMeasurementDifference(current, baselineData),
    percentageChange: getPercentageChange(current, baselineData),
    isSignificant: current.pValue < 0.05
  };
}

/**
 * Async version of getGridData
 * @param date - Date to get grid data for
 * @param samplingRate - For GeoTIFF mode, sample every Nth pixel (default 2 for performance)
 */
export async function getGridDataAsync(date: Date, samplingRate: number = 2): Promise<GridPoint[]> {
  const source = getGeoTIFFDataSource();
  return await source.getGridData(date, samplingRate);
}