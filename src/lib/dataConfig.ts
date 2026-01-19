import { configureDataSource } from './lib/no2Data';

/**
 * Data Source Configuration Examples
 * 
 * Uncomment one of the configurations below to switch data sources
 */

// ===== OPTION 1: Generated Data (Default) =====
// Uses synthetic data - no setup required
export function useGeneratedData() {
  configureDataSource({
    mode: 'generated'
  });
}

// ===== OPTION 2: GeoTIFF Data (Local Files) =====
// Requires GeoTIFF files in public/data directory
export function useLocalGeoTIFFData() {
  configureDataSource({
    mode: 'geotiff',
    geotiffBaseUrl: '/data',
    baselineGeotiffUrl: '/data/baseline.tif',
    citiesDataUrl: '/data/cities.json' // Optional
  });
}

// ===== OPTION 3: GeoTIFF Data (Remote CDN) =====
// Load GeoTIFF files from a remote server
export function useRemoteGeoTIFFData() {
  configureDataSource({
    mode: 'geotiff',
    geotiffBaseUrl: 'https://your-cdn.com/no2-data',
    baselineGeotiffUrl: 'https://your-cdn.com/no2-data/baseline.tif',
    citiesDataUrl: 'https://your-cdn.com/no2-data/cities.json'
  });
}

// ===== OPTION 4: Hybrid (GeoTIFF overlay, default cities) =====
// Use GeoTIFF for map overlay but default city list
export function useHybridData() {
  configureDataSource({
    mode: 'geotiff',
    geotiffBaseUrl: '/data',
    baselineGeotiffUrl: '/data/baseline.tif'
    // citiesDataUrl omitted - will use default MAJOR_GERMAN_CITIES
  });
}

// ===== Active Configuration =====
// Call one of the functions above to activate a data source
// Default: Generated data (no action needed)

// To use GeoTIFF data, uncomment the line below:
// useHybridData();
