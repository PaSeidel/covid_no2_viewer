import {
  loadTimeSeriesGeoTIFF,
  loadGeoTIFF,
  rasterToGridPoints,
  sampleRasterBilinear,
  geotiffCache,
  GeoTIFFMetadata,
} from './geotiffLoader';
import {
  GridPoint,
  CityTimepoint,
  MAJOR_GERMAN_CITIES,
  City,
  DataSourceConfig,
} from './no2Data';

// Helper function to fetch JSON with error handling
async function safeFetchJson(url: string) {
  console.log('Fetching JSON from:', url);
  const response = await fetch(url);
  
  const contentType = response.headers.get('content-type');
  console.log('Response status:', response.status);
  console.log('Content-Type:', contentType);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  if (!contentType || !contentType.includes('application/json')) {
    const text = await response.text();
    console.error('Expected JSON but got HTML/text:', text.substring(0, 300));
    throw new Error(`Expected JSON but got: ${contentType}`);
  }
  
  return response.json();
}

/**
 * GeoTIFF-based data source for NO2 measurements
 */
export class GeoTIFFDataSource {
  private config: DataSourceConfig;
  private baselineData: {
    metadata: GeoTIFFMetadata;
    data: Float32Array | Int32Array | Uint16Array;
  } | null = null;
  private cities: City[] = MAJOR_GERMAN_CITIES;

  constructor(config: DataSourceConfig) {
    this.config = config;
  }

  /**
   * Load baseline data (pre-COVID average)
   */
  async loadBaseline(date: Date): Promise<void> {
    if (!this.config.geotiffBaseUrl) {
      throw new Error('GeoTIFF URL not configured');
    }

    const year = 2019;
    const month = date.getMonth() + 1;

    this.baselineData = await loadTimeSeriesGeoTIFF(this.config.geotiffBaseUrl!, year, month);
  }

  /**
   * Load cities data from JSON file
   */
  async loadCities(): Promise<void> {
    if (!this.config.citiesDataUrl) {
      // Use default cities if no URL provided
      this.cities = MAJOR_GERMAN_CITIES;
      return;
    }

    try {
      const url = `${this.config.citiesDataUrl}/cities.json`;
      const data = await safeFetchJson(url);
      this.cities = data;
    } catch (error) {
      console.warn('Failed to load cities data, using defaults:', error);
      this.cities = MAJOR_GERMAN_CITIES;
    }
  }

  /**
   * Get grid data for a specific date
   */
  async getGridData(date: Date, samplingRate: number = 1): Promise<GridPoint[]> {
    if (!this.config.geotiffBaseUrl) {
      throw new Error('GeoTIFF base URL not configured');
    }

    await this.loadBaseline(date); 

    const year = date.getFullYear();
    const month = date.getMonth() + 1; // getMonth() returns 0-11

    // Load time-series data for the given date
    const cacheKey = `${year}-${month}`;
    const currentData = await geotiffCache.get(cacheKey, () =>
      loadTimeSeriesGeoTIFF(this.config.geotiffBaseUrl!, year, month).then(
        (result) => {
          if (!result) {
            throw new Error(
              `Failed to load GeoTIFF for ${year}-${month}`
            );
          }
          return result;
        }
      )
    );

    // Convert raster to grid points with difference calculation
    const gridPoints = rasterToGridPoints(
      currentData.data,
      currentData.metadata,
      this.baselineData!.data,
      samplingRate
    );

    return gridPoints;
  }

  /**
   * Get measurements for all cities at a specific date
   */
  async getCurrentMeasurements(date: Date): Promise<CityTimepoint[]> {
    if (!this.config.geotiffBaseUrl) {
      throw new Error('GeoTIFF base URL not configured');
    }

    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    // Load time-series data
    const monthStr = month.toString().padStart(2, '0');
    const url = `${this.config.citiesDataUrl}/city_timepoints_${year}_${monthStr}.json`;
    const data = await safeFetchJson(url);

    return data.map((item: any) => ({
        ...item,
        timestamp: new Date(item.timestamp)
      }));
  }

  /**
   * Get available cities
   */
  getCities(): City[] {
    return this.cities;
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    geotiffCache.clear();
    this.baselineData = null;
  }
}
