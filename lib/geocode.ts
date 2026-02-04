/**
 * Nominatim Geocoding Service (OpenStreetMap)
 * Free geocoding service for converting addresses to coordinates
 * No API key required - completely free!
 */

interface GeocodingResult {
    latitude: number;
    longitude: number;
}

interface NominatimResponse {
    lat: string;
    lon: string;
    display_name: string;
}

/**
 * Geocode an address using Nominatim (OpenStreetMap)
 * @param address - Full address string (e.g., "123 Main St, Little Rock, AR 72201")
 * @returns Coordinates object with latitude and longitude
 */
export const geocodeAddress = async (address: string): Promise<GeocodingResult> => {
    try {
        // Nominatim requires a User-Agent header
        const userAgent = 'Grow104GardenApp/1.0 (contact@grow104.org)';

        // Build the API URL
        const baseUrl = 'https://nominatim.openstreetmap.org/search';
        const params = new URLSearchParams({
            q: address,
            format: 'json',
            limit: '1',
            countrycodes: 'us', // Limit to US addresses for better accuracy
        });

        const response = await fetch(`${baseUrl}?${params.toString()}`, {
            headers: {
                'User-Agent': userAgent,
            },
        });

        if (!response.ok) {
            throw new Error(`Geocoding API error: ${response.statusText}`);
        }

        const data: NominatimResponse[] = await response.json();

        if (!data || data.length === 0) {
            // Return default coordinates (Little Rock, AR) if address not found
            console.warn('No geocoding results found for address:', address);
            return {
                latitude: 34.7465,
                longitude: -92.2896,
            };
        }

        const result = data[0];

        return {
            latitude: parseFloat(result.lat),
            longitude: parseFloat(result.lon),
        };
    } catch (error: any) {
        console.error('Geocoding error:', error);
        // Return default coordinates (Little Rock, AR) on error
        return {
            latitude: 34.7465,
            longitude: -92.2896,
        };
    }
};

/**
 * Reverse geocode coordinates to an address
 * @param latitude - Latitude coordinate
 * @param longitude - Longitude coordinate
 * @returns Address string
 */
export const reverseGeocode = async (latitude: number, longitude: number): Promise<string> => {
    try {
        const userAgent = 'Grow104GardenApp/1.0 (contact@grow104.org)';

        const baseUrl = 'https://nominatim.openstreetmap.org/reverse';
        const params = new URLSearchParams({
            lat: latitude.toString(),
            lon: longitude.toString(),
            format: 'json',
        });

        const response = await fetch(`${baseUrl}?${params.toString()}`, {
            headers: {
                'User-Agent': userAgent,
            },
        });

        if (!response.ok) {
            throw new Error(`Reverse geocoding API error: ${response.statusText}`);
        }

        const data: NominatimResponse = await response.json();

        return data.display_name || 'Address not found';
    } catch (error: any) {
        console.error('Reverse geocoding error:', error);
        return 'Address not found';
    }
};
