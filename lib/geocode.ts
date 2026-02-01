/**
 * Geocode an address to latitude/longitude coordinates
 * Uses Google Maps Geocoding API
 */
export const geocodeAddress = async (address: string): Promise<{ latitude: number; longitude: number }> => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
        throw new Error('GOOGLE_MAPS_API_KEY not configured');
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;

    try {
        const response = await fetch(url);
        const data: any = await response.json();

        if (data.status === 'OK' && data.results?.[0]) {
            const { lat, lng } = data.results[0].geometry.location;
            return {
                latitude: lat,
                longitude: lng
            };
        }

        if (data.status === 'ZERO_RESULTS') {
            throw new Error('Address not found');
        }

        throw new Error(`Geocoding failed: ${data.status}`);
    } catch (error: any) {
        console.error('Geocoding error:', error);
        throw new Error(error.message || 'Failed to geocode address');
    }
};

/**
 * Reverse geocode coordinates to address
 */
export const reverseGeocode = async (latitude: number, longitude: number): Promise<string> => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
        throw new Error('GOOGLE_MAPS_API_KEY not configured');
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`;

    try {
        const response = await fetch(url);
        const data: any = await response.json();

        if (data.status === 'OK' && data.results?.[0]) {
            return data.results[0].formatted_address;
        }

        throw new Error(`Reverse geocoding failed: ${data.status}`);
    } catch (error: any) {
        console.error('Reverse geocoding error:', error);
        throw new Error(error.message || 'Failed to reverse geocode coordinates');
    }
};
