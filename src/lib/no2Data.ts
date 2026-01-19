import { GeoTIFFDataSource } from './geotiffDataSource';

// Major German cities with population > 100k
export interface City {
  name: string;
  lat: number;
  lng: number;
  population: number;
}

export const MAJOR_GERMAN_CITIES: City[] = [
  { name: 'Berlin', lat: 52.52, lng: 13.405, population: 3645000 },
  { name: 'Hamburg', lat: 53.5511, lng: 9.9937, population: 1841000 },
  { name: 'Munich', lat: 48.1351, lng: 11.582, population: 1472000 },
  { name: 'Cologne', lat: 50.9375, lng: 6.9603, population: 1086000 },
  { name: 'Frankfurt', lat: 50.1109, lng: 8.6821, population: 753000 },
  { name: 'Stuttgart', lat: 48.7758, lng: 9.1829, population: 634000 },
  { name: 'Düsseldorf', lat: 51.2277, lng: 6.7735, population: 619000 },
  { name: 'Dortmund', lat: 51.5136, lng: 7.4653, population: 587000 },
  { name: 'Essen', lat: 51.4556, lng: 7.0116, population: 583000 },
  { name: 'Leipzig', lat: 51.3397, lng: 12.3731, population: 587000 },
  { name: 'Bremen', lat: 53.0793, lng: 8.8017, population: 569000 },
  { name: 'Dresden', lat: 51.0504, lng: 13.7373, population: 556000 },
  { name: 'Hanover', lat: 52.3759, lng: 9.732, population: 535000 },
  { name: 'Nuremberg', lat: 49.4521, lng: 11.0767, population: 518000 },
  { name: 'Duisburg', lat: 51.4344, lng: 6.7623, population: 498000 },
  { name: 'Bochum', lat: 51.4818, lng: 7.2162, population: 365000 },
  { name: 'Wuppertal', lat: 51.2562, lng: 7.1508, population: 355000 },
  { name: 'Bielefeld', lat: 52.0302, lng: 8.5325, population: 334000 },
  { name: 'Bonn', lat: 50.7374, lng: 7.0982, population: 327000 },
  { name: 'Münster', lat: 51.9607, lng: 7.6261, population: 315000 },
  { name: 'Karlsruhe', lat: 49.0069, lng: 8.4037, population: 313000 },
  { name: 'Mannheim', lat: 49.4875, lng: 8.4660, population: 310000 },
  { name: 'Augsburg', lat: 48.3705, lng: 10.8978, population: 296000 },
  { name: 'Wiesbaden', lat: 50.0826, lng: 8.2400, population: 278000 },
  { name: 'Gelsenkirchen', lat: 51.5177, lng: 7.0857, population: 260000 },
  { name: 'Mönchengladbach', lat: 51.1805, lng: 6.4428, population: 261000 },
  { name: 'Braunschweig', lat: 52.2689, lng: 10.5268, population: 249000 },
  { name: 'Chemnitz', lat: 50.8278, lng: 12.9214, population: 246000 },
  { name: 'Aachen', lat: 50.7753, lng: 6.0839, population: 249000 },
  { name: 'Kiel', lat: 54.3233, lng: 10.1228, population: 247000 },
];

export interface NO2Measurement {
  cityName: string;
  lat: number;
  lng: number;
  value: number; // NO2 concentration in μg/m³
  timestamp: Date;
}

export interface GridPoint {
  lat: number;
  lng: number;
  value: number;
  difference: number;
}

export interface BaselineMeasurement {
  cityName: string;
  meanValue: number; // Average NO2 from 2017-2019
  stdDev: number; // Standard deviation
  measurements: number[]; // Array of individual measurements for statistical testing
}

// Data source configuration
export interface DataSourceConfig {
  mode: 'geotiff' | 'generated'; // Switch between GeoTIFF and generated data
  geotiffBaseUrl?: string; // Base URL for GeoTIFF files
  baselineGeotiffUrl?: string; // URL for baseline GeoTIFF
  citiesDataUrl?: string; // URL for cities JSON data
}

// Default configuration - uses generated data initially
let dataSourceConfig: DataSourceConfig = {
  mode: 'generated',
};

/**
 * Configure data source for the application
 */
export function configureDataSource(config: Partial<DataSourceConfig>) {
  dataSourceConfig = { ...dataSourceConfig, ...config };
}

/**
 * Get current data source configuration
 */
export function getDataSourceConfig(): DataSourceConfig {
  return { ...dataSourceConfig };
}

// Singleton GeoTIFF data source
let geotiffDataSource: GeoTIFFDataSource | null = null;

/**
 * Get or create GeoTIFF data source
 */
function getGeoTIFFDataSource(): GeoTIFFDataSource {
  if (!geotiffDataSource) {
    geotiffDataSource = new GeoTIFFDataSource(dataSourceConfig);
  }
  return geotiffDataSource;
}

/**
 * Reset GeoTIFF data source (useful when configuration changes)
 */
export function resetGeoTIFFDataSource(): void {
  if (geotiffDataSource) {
    geotiffDataSource.clearCache();
  }
  geotiffDataSource = null;
}

// Generate baseline data (2017-2019 average)
function generateBaselineData(): Map<string, BaselineMeasurement> {
  const baseline = new Map<string, BaselineMeasurement>();
  
  MAJOR_GERMAN_CITIES.forEach(city => {
    // Base NO2 levels vary by city size and industrial activity
    // Larger cities typically had higher pre-COVID NO2 levels
    const baseLevel = 25 + (city.population / 100000) * 1.5 + (Math.random() - 0.5) * 5;
    
    // Generate ~100 measurements for statistical testing
    const measurements: number[] = [];
    for (let i = 0; i < 100; i++) {
      measurements.push(baseLevel + (Math.random() - 0.5) * 8);
    }
    
    const meanValue = measurements.reduce((a, b) => a + b, 0) / measurements.length;
    const variance = measurements.reduce((sum, val) => sum + Math.pow(val - meanValue, 2), 0) / measurements.length;
    const stdDev = Math.sqrt(variance);
    
    baseline.set(city.name, {
      cityName: city.name,
      meanValue,
      stdDev,
      measurements
    });
  });
  
  return baseline;
}

// Generate grid of measurement points across Germany for continuous overlay
function generateGridMeasurements(date: Date, baseline: Map<string, BaselineMeasurement>): GridPoint[] {
  const gridPoints: GridPoint[] = [];
  
  // Germany bounding box (approximate)
  const minLat = 47.3;
  const maxLat = 55.1;
  const minLng = 5.9;
  const maxLng = 15.0;
  
  // Grid resolution - reduced for better transparency
  const latStep = 0.6;
  const lngStep = 0.8;
  
  // Calculate COVID impact factor based on timeline
  const year = date.getFullYear();
  const month = date.getMonth();
  let covidImpactFactor = 1.0;
  
  if (year === 2020) {
    if (month >= 2 && month <= 4) {
      covidImpactFactor = 0.55 - month * 0.05;
    } else if (month >= 5 && month <= 8) {
      covidImpactFactor = 0.65 + (month - 5) * 0.05;
    } else if (month >= 9) {
      covidImpactFactor = 0.75;
    } else {
      covidImpactFactor = 0.95;
    }
  } else if (year === 2021) {
    if (month <= 5) {
      covidImpactFactor = 0.70 + month * 0.02;
    } else {
      covidImpactFactor = 0.80 + (month - 6) * 0.02;
    }
  } else if (year === 2022) {
    covidImpactFactor = 0.85 + month * 0.01;
  } else if (year >= 2023) {
    covidImpactFactor = 0.95 + (Math.random() - 0.5) * 0.05;
  }
  
  // Create grid points
  for (let lat = minLat; lat <= maxLat; lat += latStep) {
    for (let lng = minLng; lng <= maxLng; lng += lngStep) {
      // Find nearest cities to interpolate NO2 values
      const distances = MAJOR_GERMAN_CITIES.map(city => ({
        city,
        distance: Math.sqrt(Math.pow(lat - city.lat, 2) + Math.pow(lng - city.lng, 2))
      })).sort((a, b) => a.distance - b.distance);
      
      // Use inverse distance weighting from nearest 3 cities
      const nearest = distances.slice(0, 3);
      const totalWeight = nearest.reduce((sum, d) => sum + 1 / (d.distance + 0.1), 0);
      
      let baselineValue = 0;
      nearest.forEach(({ city, distance }) => {
        const cityBaseline = baseline.get(city.name);
        if (cityBaseline) {
          const weight = (1 / (distance + 0.1)) / totalWeight;
          baselineValue += cityBaseline.meanValue * weight;
        }
      });
      
      // Apply COVID impact with spatial variation
      const spatialVariation = 0.9 + Math.random() * 0.2;
      const currentValue = baselineValue * covidImpactFactor * spatialVariation;
      const difference = currentValue - baselineValue;
      
      gridPoints.push({
        lat,
        lng,
        value: currentValue,
        difference
      });
    }
  }
  
  return gridPoints;
}

// Generate time-series data from 2020 onwards
function generateTimeSeriesData(date: Date, baseline: Map<string, BaselineMeasurement>): NO2Measurement[] {
  const measurements: NO2Measurement[] = [];
  const year = date.getFullYear();
  const month = date.getMonth();
  
  // Calculate COVID impact factor based on timeline
  let covidImpactFactor = 1.0;
  
  if (year === 2020) {
    if (month >= 2 && month <= 4) {
      // March-May 2020: First lockdown, dramatic reduction
      covidImpactFactor = 0.55 - month * 0.05;
    } else if (month >= 5 && month <= 8) {
      // Summer 2020: Gradual recovery
      covidImpactFactor = 0.65 + (month - 5) * 0.05;
    } else if (month >= 9) {
      // Fall 2020: Second wave, moderate reduction
      covidImpactFactor = 0.75;
    } else {
      // Jan-Feb 2020: Pre-lockdown
      covidImpactFactor = 0.95;
    }
  } else if (year === 2021) {
    if (month <= 5) {
      // Winter/Spring 2021: Continued restrictions
      covidImpactFactor = 0.70 + month * 0.02;
    } else {
      // Summer/Fall 2021: Recovery
      covidImpactFactor = 0.80 + (month - 6) * 0.02;
    }
  } else if (year === 2022) {
    // 2022: Gradual return to normal
    covidImpactFactor = 0.85 + month * 0.01;
  } else if (year >= 2023) {
    // 2023+: Near baseline with slight improvements
    covidImpactFactor = 0.95 + (Math.random() - 0.5) * 0.05;
  }
  
  MAJOR_GERMAN_CITIES.forEach(city => {
    const baselineData = baseline.get(city.name);
    if (!baselineData) return;
    
    // Apply COVID impact with some random variation
    const value = baselineData.meanValue * covidImpactFactor * (0.95 + Math.random() * 0.1);
    
    measurements.push({
      cityName: city.name,
      lat: city.lat,
      lng: city.lng,
      value,
      timestamp: date
    });
  });
  
  return measurements;
}

// Calculate difference from baseline
export function getMeasurementDifference(
  current: NO2Measurement,
  baseline: BaselineMeasurement
): number {
  return current.value - baseline.meanValue;
}

// Calculate percentage change from baseline
export function getPercentageChange(
  current: NO2Measurement,
  baseline: BaselineMeasurement
): number {
  return ((current.value - baseline.meanValue) / baseline.meanValue) * 100;
}

// Perform t-test to check if difference is significant
export function isStatisticallySignificant(
  current: NO2Measurement,
  baseline: BaselineMeasurement,
  alpha: number = 0.05
): boolean {
  // Generate current period measurements (simulate ~30 measurements at current level)
  const currentMeasurements: number[] = [];
  for (let i = 0; i < 30; i++) {
    currentMeasurements.push(current.value + (Math.random() - 0.5) * 5);
  }
  
  const n1 = baseline.measurements.length;
  const n2 = currentMeasurements.length;
  
  const mean1 = baseline.meanValue;
  const mean2 = currentMeasurements.reduce((a, b) => a + b, 0) / n2;
  
  const variance1 = baseline.stdDev * baseline.stdDev;
  const variance2 = currentMeasurements.reduce((sum, val) => sum + Math.pow(val - mean2, 2), 0) / n2;
  
  // Welch's t-test
  const tStatistic = (mean1 - mean2) / Math.sqrt(variance1 / n1 + variance2 / n2);
  
  // Simplified: using t-critical value of ~2.0 for typical degrees of freedom
  // A proper implementation would calculate exact degrees of freedom and use t-distribution
  const tCritical = 2.0;
  
  return Math.abs(tStatistic) > tCritical;
}

// Singleton baseline data
let baselineData: Map<string, BaselineMeasurement> | null = null;

export function getBaselineData(): Map<string, BaselineMeasurement> {
  if (dataSourceConfig.mode === 'geotiff') {
    // Return a Promise wrapper that resolves to the baseline data
    throw new Error('Use async getBaselineDataAsync() for GeoTIFF mode');
  }
  
  if (!baselineData) {
    baselineData = generateBaselineData();
  }
  return baselineData;
}

/**
 * Async version of getBaselineData that works with both modes
 */
export async function getBaselineDataAsync(date: Date): Promise<Map<string, BaselineMeasurement>> {
  if (dataSourceConfig.mode === 'geotiff') {
    const source = getGeoTIFFDataSource();
    return await source.getBaselineData(date);
  }
  
  return getBaselineData();
}

export function getCurrentMeasurements(date: Date): NO2Measurement[] {
  if (dataSourceConfig.mode === 'geotiff') {
    throw new Error('Use async getCurrentMeasurementsAsync() for GeoTIFF mode');
  }
  
  return generateTimeSeriesData(date, getBaselineData());
}

/**
 * Async version of getCurrentMeasurements that works with both modes
 */
export async function getCurrentMeasurementsAsync(date: Date): Promise<NO2Measurement[]> {
  if (dataSourceConfig.mode === 'geotiff') {
    const source = getGeoTIFFDataSource();
    return await source.getCurrentMeasurements(date);
  }
  
  return getCurrentMeasurements(date);
}

export function getCityData(cityName: string, date: Date) {
  if (dataSourceConfig.mode === 'geotiff') {
    throw new Error('Use async getCityDataAsync() for GeoTIFF mode');
  }
  
  const baseline = getBaselineData().get(cityName);
  const current = getCurrentMeasurements(date).find(m => m.cityName === cityName);
  
  if (!baseline || !current) return null;
  
  return {
    baseline,
    current,
    difference: getMeasurementDifference(current, baseline),
    percentageChange: getPercentageChange(current, baseline),
    isSignificant: isStatisticallySignificant(current, baseline)
  };
}

/**
 * Async version of getCityData that works with both modes
 */
export async function getCityDataAsync(cityName: string, date: Date) {
  const baseline = await getBaselineDataAsync();
  const measurements = await getCurrentMeasurementsAsync(date);
  
  const baselineData = baseline.get(cityName);
  const current = measurements.find(m => m.cityName === cityName);
  
  if (!baselineData || !current) return null;
  
  return {
    baseline: baselineData,
    current,
    difference: getMeasurementDifference(current, baselineData),
    percentageChange: getPercentageChange(current, baselineData),
    isSignificant: isStatisticallySignificant(current, baselineData)
  };
}

export function getGridData(date: Date): GridPoint[] {
  if (dataSourceConfig.mode === 'geotiff') {
    throw new Error('Use async getGridDataAsync() for GeoTIFF mode');
  }
  
  return generateGridMeasurements(date, getBaselineData());
}

/**
 * Async version of getGridData that works with both modes
 * @param date - Date to get grid data for
 * @param samplingRate - For GeoTIFF mode, sample every Nth pixel (default 2 for performance)
 */
export async function getGridDataAsync(date: Date, samplingRate: number = 2): Promise<GridPoint[]> {
  if (dataSourceConfig.mode === 'geotiff') {
    const source = getGeoTIFFDataSource();
    return await source.getGridData(date, samplingRate);
  }
  
  return getGridData(date);
}