/**
 * Location utility functions
 * Handles location operations, GPS access, and location state management
 * 
 * This module provides:
 * - GPS location access with error handling
 * - Fallback strategies for location retrieval
 * - Location data validation and formatting
 * - Cross-browser geolocation support
 */

/**
 * Get current location using GPS with comprehensive error handling and timeout
 * Uses the browser's native geolocation API with optimized settings for accuracy vs speed
 * 
 * @param {Object} options - Configuration options for GPS request
 * @param {number} options.timeout - Maximum time to wait for location (default: 10000ms)
 * @param {boolean} options.enableHighAccuracy - Request high accuracy GPS (default: true)
 * @param {number} options.maximumAge - Maximum age of cached location (default: 60000ms)
 * @returns {Promise<Object>} Location object with {lat, lng, accuracy, timestamp}
 */
export const getCurrentLocationGPS = (options = {}) => {
    // Destructure options with sensible defaults
    const {
        timeout = 10000,           // 10 second timeout - balance between accuracy and UX
        enableHighAccuracy = true, // Request GPS/high accuracy (vs network-based location)
        maximumAge = 60000        // Accept location cached within last 60 seconds
    } = options;

    return new Promise((resolve, reject) => {
        // Check if geolocation is supported in this browser
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported by this browser'));
            return;
        }

        // Configure geolocation options for optimal performance
        const geoOptions = {
            enableHighAccuracy,  // Use GPS for higher accuracy (slower but more precise)
            timeout,            // Maximum time to wait for location
            maximumAge         // Accept cached location if recent enough
        };

        // Request current position using native browser API
        navigator.geolocation.getCurrentPosition(
            // SUCCESS CALLBACK: Called when location is successfully obtained
            (position) => {
                resolve({
                    lat: position.coords.latitude,      // Latitude in decimal degrees
                    lng: position.coords.longitude,     // Longitude in decimal degrees
                    accuracy: position.coords.accuracy, // Accuracy in meters
                    timestamp: position.timestamp       // When location was obtained
                });
            },

            // ERROR CALLBACK: Called when location access fails
            (error) => {
                // Provide user-friendly error messages based on error type
                let message = 'Location access failed';

                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        // User explicitly denied location access
                        message = 'Location access denied by user';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        // Location service unavailable (no GPS, network issues, etc.)
                        message = 'Location information unavailable';
                        break;
                    case error.TIMEOUT:
                        // Request timed out - user didn't respond or GPS took too long
                        message = 'Location request timed out';
                        break;
                    default:
                        // Unexpected error - include original message for debugging
                        message = `Location error: ${error.message}`;
                        break;
                }
                reject(new Error(message));
            },

            // Pass configuration options to geolocation API
            geoOptions
        );
    });
};

/**
 * Smart location retrieval with multiple fallback strategies
 * Implements a resilient approach to getting user location:
 * 1. Try saved location from IndexedDB (fast, works offline)
 * 2. Fall back to fresh GPS location (accurate but slower)
 * 3. Fall back to default coordinates (always works)
 * 
 * @param {Function} getLocation - Function to retrieve saved location from IndexedDB
 * @param {Object} options - Configuration options for location retrieval
 * @param {boolean} options.forceFresh - Skip saved location, force GPS (default: false)
 * @param {Object} options.fallback - Default coordinates if all else fails (default: Cairo)
 * @param {boolean} options.throwOnError - Throw errors vs use fallback (default: false)
 * @param {number} options.timeout - GPS timeout in milliseconds (default: 10000)
 * @returns {Promise<Object>} Location coordinates {lat, lng}
 */
export const getLocationWithFallback = async (getLocation, options = {}) => {
    // Extract options with defaults optimized for user experience
    const {
        forceFresh = false,                        // Usually prefer saved location for speed
        fallback = { lat: 30.033, lng: 31.233 }, // Cairo, Egypt - central location
        throwOnError = false,                     // Graceful degradation by default
        timeout = 10000                          // 10 second GPS timeout
    } = options;

    try {
        // STRATEGY 1: Try saved location first (unless forcing fresh GPS)
        if (!forceFresh) {
            // Attempt to get previously saved location from IndexedDB
            const saved = await getLocation({
                forceFresh: false,    // Use saved data
                fallback,            // Fallback if no saved location
                throwOnError: false  // Don't throw errors at this stage
            });

            // Validate that we got valid coordinates
            if (saved && saved.lat && saved.lng) {
                return saved; // Fast path - use saved location
            }
        }

        // STRATEGY 2: Get fresh GPS location
        // This is slower but more accurate, used when:
        // - No saved location exists
        // - User explicitly requested fresh location
        const gpsLocation = await getCurrentLocationGPS({ timeout });

        // Return simplified coordinate object (strip metadata like accuracy)
        return {
            lat: gpsLocation.lat,
            lng: gpsLocation.lng
        };

    } catch (error) {
        // STRATEGY 3: Error handling and fallback
        if (throwOnError) {
            // Caller wants to handle errors explicitly
            throw error;
        }

        // Log warning for debugging but don't break user experience
        console.warn('Location access failed, using fallback:', error.message);

        // Return fallback coordinates so app continues to work
        return fallback;
    }
};

/**
 * Comprehensive validation for location coordinate objects
 * Ensures location data is valid before using it with mapping APIs
 * Prevents errors from invalid, null, or out-of-range coordinates
 * 
 * @param {Object} location - Location object to validate
 * @param {number|string} location.lat - Latitude coordinate
 * @param {number|string} location.lng - Longitude coordinate
 * @returns {boolean} True if location has valid coordinates within Earth's bounds
 */
export const isValidLocation = (location) => {
    // Check if location exists and is an object
    if (!location || typeof location !== 'object') {
        return false;
    }

    // Extract lat/lng properties
    const { lat, lng } = location;

    // Check if both coordinates exist (not null, undefined, or empty string)
    if (lat == null || lng == null) {
        return false;
    }

    // Convert to numbers (handles string coordinates)
    const numLat = +lat;  // Unary plus operator for conversion
    const numLng = +lng;

    // Check if conversion resulted in valid numbers
    if (isNaN(numLat) || isNaN(numLng)) {
        return false;
    }

    // Validate coordinates are within Earth's valid ranges
    // Latitude: -90 to +90 degrees (South Pole to North Pole)
    // Longitude: -180 to +180 degrees (International Date Line)
    if (numLat < -90 || numLat > 90 || numLng < -180 || numLng > 180) {
        return false;
    }

    // All validation checks passed
    return true;
};

/**
 * Format location coordinates for consistent display across the application
 * Provides standardized, user-friendly coordinate representation
 * Handles invalid locations gracefully with fallback text
 * 
 * @param {Object} location - Location coordinates to format
 * @param {number|string} location.lat - Latitude coordinate
 * @param {number|string} location.lng - Longitude coordinate
 * @param {number} precision - Number of decimal places to display (default: 6)
 * @returns {string} Formatted location string (e.g., "Lat: 30.033000, Lng: 31.233000")
 * 
 * Examples:
 * - formatLocation({lat: 30.033, lng: 31.233}) → "Lat: 30.033000, Lng: 31.233000"
 * - formatLocation({lat: 40.7, lng: -74.0}, 2) → "Lat: 40.70, Lng: -74.00"
 * - formatLocation(null) → "Invalid location"
 */
export const formatLocation = (location, precision = 6) => {
    // Validate location before formatting
    if (!isValidLocation(location)) {
        return 'Invalid location';
    }

    // Convert coordinates to numbers and format with specified precision
    const lat = (+location.lat).toFixed(precision);  // Convert to number, then format
    const lng = (+location.lng).toFixed(precision);

    // Return standardized format string
    return `Lat: ${lat}, Lng: ${lng}`;
};
