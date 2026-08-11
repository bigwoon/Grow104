/**
 * Nominatim Geocoding Service (OpenMapStreet)
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
 * Geocode an address using Nominatim (OpenMapStreet)
 * @param address - Full address string (e.g., "123 Main St, Little Rock, AR 72201")
 * @returns Coordinates object with latitude and longitude
 */
export const geocodeAddress = async (address: string): Promise<GeocodingResult> => {
    try {
        const userAgent = 'Grow104GardenApp/1.0 (contact@grow104.org)';

        // Ensure query always targets Fort Worth, TX 76104 for accuracy
        let fullQuery = address || '';
        if (!fullQuery.toLowerCase().includes('fort worth') && !fullQuery.toLowerCase().includes('76104')) {
            fullQuery = `${address}, Fort Worth, TX 76104`;
        }

        const baseUrl = 'https://nominatim.openstreetmap.org/search';
        const params = new URLSearchParams({
            q: fullQuery,
            format: 'json',
            limit: '1',
            countrycodes: 'us',
        });

        const response = await fetch(`${baseUrl}?${params.toString()}`, {
            headers: {
                'User-Agent': userAgent,
            },
        });

        if (!response.ok) {
            throw new Error(`Geocoding API error: ${response.statusText}`);
        }

        const data = await response.json() as NominatimResponse[];

        if (!data || data.length === 0) {
            console.warn('No geocoding results found for address:', fullQuery);
            // Default center fallback for Southside Fort Worth, TX 76104
            return {
                latitude: 32.7300,
                longitude: -97.3200,
            };
        }

        const result = data[0];

        return {
            latitude: parseFloat(result.lat),
            longitude: parseFloat(result.lon),
        };
    } catch (error: any) {
        console.error('Geocoding error:', error);
        // Default center fallback for Southside Fort Worth, TX 76104
        return {
            latitude: 32.7300,
            longitude: -97.3200,
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

        const data = await response.json() as NominatimResponse;

        return data.display_name || 'Address not found';
    } catch (error: any) {
        console.error('Reverse geocoding error:', error);
        return 'Address not found';
    }
};
