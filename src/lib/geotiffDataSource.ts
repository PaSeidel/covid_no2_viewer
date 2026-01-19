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
  NO2Measurement,
  BaselineMeasurement,
  MAJOR_GERMAN_CITIES,
  City,
  DataSourceConfig,
} from './no2Data';

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
  private cityBaselineCache: Map<string, BaselineMeasurement> = new Map();

  constructor(config: DataSourceConfig) {
    this.config = config;
  }

  /**
   * Load baseline data (pre-COVID average)
   */
  async loadBaseline(date: Date): Promise<void> {
    if (!this.config.baselineGeotiffUrl) {
      throw new Error('Baseline GeoTIFF URL not configured');
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
      const response = await fetch(this.config.citiesDataUrl);
      const data = await response.json();
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
  async getCurrentMeasurements(date: Date): Promise<NO2Measurement[]> {
    if (!this.config.geotiffBaseUrl) {
      throw new Error('GeoTIFF base URL not configured');
    }

    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    // Load time-series data
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

    // Sample values at city locations
    const measurements: NO2Measurement[] = [];
    for (const city of this.cities) {
      const value = sampleRasterBilinear(
        city.lat,
        city.lng,
        currentData.data,
        currentData.metadata
      );

      if (value !== null) {
        measurements.push({
          cityName: city.name,
          lat: city.lat,
          lng: city.lng,
          value,
          timestamp: date,
        });
      }
    }

    return measurements;
  }

  /**
   * Get baseline data for all cities
   */
  async getBaselineData(date: Date): Promise<Map<string, BaselineMeasurement>> {
    if (this.cityBaselineCache.size > 0) {
      return this.cityBaselineCache;
    }

    await this.loadBaseline(date);

    // Sample baseline values at city locations
    for (const city of this.cities) {
      const value = sampleRasterBilinear(
        city.lat,
        city.lng,
        this.baselineData!.data,
        this.baselineData!.metadata
      );

      if (value !== null) {
        // Generate synthetic measurements for statistical testing
        // In a real application, these would come from historical data
        const measurements: number[] = [];
        const stdDev = value * 0.15; // Assume 15% coefficient of variation

        for (let i = 0; i < 100; i++) {
          const randomValue =
            value + (Math.random() - 0.5) * stdDev * 2;
          measurements.push(randomValue);
        }

        const meanValue =
          measurements.reduce((a, b) => a + b, 0) / measurements.length;
        const variance =
          measurements.reduce(
            (sum, val) => sum + Math.pow(val - meanValue, 2),
            0
          ) / measurements.length;

        this.cityBaselineCache.set(city.name, {
          cityName: city.name,
          meanValue,
          stdDev: Math.sqrt(variance),
          measurements,
        });
      }
    }

    return this.cityBaselineCache;
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
    this.cityBaselineCache.clear();
    this.baselineData = null;
  }
}
