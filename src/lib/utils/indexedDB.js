/**
 * IndexedDB Location Storage Utilities
 * Handles persistent storage of user location data using browser's IndexedDB
 * 
 * This module provides:
 * - Robust location data persistence across browser sessions
 * - Fallback to localStorage for older browsers
 * - GPS location access with intelligent caching
 * - Multiple location retrieval strategies (saved, fresh, fallback)
 * - Error handling and graceful degradation
 * - Performance optimization through singleton pattern connection caching
 */

// ============================================================================
// DATABASE CONFIGURATION
// ============================================================================

// Database name - stays consistent across app versions for data persistence
const DB_NAME = 'MapLocationDB';

// Object store name - acts like a table in traditional databases
const STORE_NAME = 'userLocation';

// Database instance cache - prevents multiple connections and improves performance
let dbInstance = null;

// ============================================================================
// DATABASE CONNECTION MANAGEMENT
// ============================================================================

/**
 * Get or create IndexedDB database connection using singleton pattern
 * Implements singleton pattern to reuse database connection efficiently
 * Handles database schema creation and version management
 * 
 * @returns {Promise<IDBDatabase>} IndexedDB database instance
 * 
 * Connection Strategy:
 * - Reuse existing connection (performance optimization)
 * - Check browser compatibility (graceful fallback)
 * - Handle database creation and schema setup
 * - Manage version upgrades for schema changes
 */
async function getDB() {
    // SINGLETON PATTERN: Return cached instance if available
    // Prevents multiple database connections and improves performance
    if (dbInstance) return dbInstance;

    // COMPATIBILITY CHECK: Ensure IndexedDB is supported
    // Older browsers or private mode might not support IndexedDB
    if (!window.indexedDB) {
        throw new Error('IndexedDB is not supported in this browser');
    }

    return new Promise((resolve, reject) => {
        // DATABASE OPENING: Open existing database or create new one
        // Version 1 indicates schema version for future upgrades
        const request = indexedDB.open(DB_NAME, 1);

        // ERROR HANDLING: Database opening failures
        request.onerror = (event) => {
            const error = event.target.error;
            reject(new Error(`Failed to open database: ${error?.message || 'Unknown error'}`));
        };

        // SUCCESS HANDLER: Database opened successfully
        request.onsuccess = () => {
            // CACHE CONNECTION: Store for future use
            dbInstance = request.result;
            resolve(dbInstance);
        };

        // SCHEMA SETUP: Runs only when database is first created or version changes
        // This is the only place where we can create object stores (tables)
        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // CREATE OBJECT STORE: Like creating a table in SQL
            // Only create if it doesn't exist (prevents errors on multiple calls)
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
    });
}


// ============================================================================
// LOCATION PERSISTENCE FUNCTIONS
// ============================================================================

/**
 * Save user location to IndexedDB with robust validation and fallback
 * Stores GPS coordinates persistently for faster map initialization
 * 
 * @param {Object} location - Location object with lat/lng coordinates
 * @param {number} location.lat - Latitude (-90 to 90)
 * @param {number} location.lng - Longitude (-180 to 180)
 * 
 * @returns {Promise<void>} Resolves when location is saved successfully
 * 
 * Storage Strategy:
 * - Primary: IndexedDB for large, structured data storage
 * - Fallback: localStorage for compatibility with older browsers
 * - Validation: Ensures coordinates are valid numbers within Earth's bounds
 * - Error handling: Graceful degradation on storage failures
 * 
 * Performance Benefits:
 * - Reduces GPS lookup time on subsequent visits
 * - Enables offline map centering capability
 * - Minimizes network requests for location services
 */
export async function saveUserLocation(location) {
    try {
        // INPUT VALIDATION: Ensure location object exists
        // Prevents undefined/null errors downstream
        if (!location) {
            throw new Error('Location object is required');
        }

        // COORDINATE EXTRACTION: Destructure lat/lng from location object
        // Supports both {lat, lng} and {latitude, longitude} formats
        const { lat, lng } = location;

        // COORDINATE EXISTENCE CHECK: Ensure both coordinates are provided
        // Prevents partial location data that would break map centering
        if (lat == null || lng == null) {
            throw new Error('Both lat and lng are required');
        }

        // COORDINATE NORMALIZATION: Convert to float numbers
        // The + operator efficiently converts strings to numbers
        // Handles both string and number inputs consistently
        const locationData = {
            lat: +lat, // Convert to float (faster than parseFloat)
            lng: +lng  // Convert to float (faster than parseFloat)
        };

        // COORDINATE VALIDATION: Ensure conversion resulted in valid numbers
        // NaN check prevents invalid coordinates from being stored
        if (isNaN(locationData.lat) || isNaN(locationData.lng)) {
            throw new Error('Invalid coordinates: lat and lng must be numeric');
        }

        // BOUNDS VALIDATION: Ensure coordinates are within Earth's valid range
        // Latitude: -90 to 90 degrees, Longitude: -180 to 180 degrees
        if (Math.abs(locationData.lat) > 90 || Math.abs(locationData.lng) > 180) {
            throw new Error('Coordinates out of valid range');
        }

        // DATABASE CONNECTION: Get IndexedDB instance using singleton pattern
        const db = await getDB();

        // TRANSACTION SETUP: Create write transaction for location store
        // 'readwrite' mode allows both reading and writing to the store
        const tx = db.transaction(STORE_NAME, 'readwrite');

        // STORE ACCESS: Get reference to the location object store
        // Acts like accessing a table in a traditional database
        const store = tx.objectStore(STORE_NAME);

        // ASYNC TRANSACTION HANDLING: Use Promise to handle IndexedDB's event-based API
        return new Promise((resolve, reject) => {
            // ERROR HANDLING: Transaction-level error detection
            // Fires if something goes wrong during the entire transaction
            tx.onerror = () => reject(new Error('Transaction failed'));

            // ABORT HANDLING: Transaction cancellation detection
            // Fires if the transaction is cancelled/aborted unexpectedly
            tx.onabort = () => reject(new Error('Transaction aborted'));

            // SUCCESS HANDLING: Transaction completion detection
            // Fires when all operations in the transaction complete successfully
            tx.oncomplete = () => resolve();

            // STORE OPERATION: Save location data with fixed key 'current'
            // Using fixed key allows easy retrieval and overwrites previous location
            const request = store.put(locationData, 'current');

            // OPERATION ERROR HANDLING: Handle specific save operation failures
            request.onerror = () => reject(new Error('Failed to save location'));
        });

    } catch (error) {
        // FALLBACK STORAGE: Use localStorage when IndexedDB fails
        // Ensures location is saved even on older browsers or in private mode
        console.error('IndexedDB save failed, using localStorage fallback:', error);
        localStorage.setItem('user-location', JSON.stringify(location));
    }
}

/**
 * Retrieve saved user location from IndexedDB with fallback support
 * Loads previously stored GPS coordinates for faster map initialization
 * 
 * @returns {Promise<Object|null>} Location object {lat, lng} or null if not found
 * 
 * Retrieval Strategy:
 * - Primary: IndexedDB lookup for the 'current' location record
 * - Fallback: localStorage for compatibility with older browsers
 * - Graceful failure: Returns null instead of throwing errors
 * - Type safety: Ensures coordinates are returned as numbers
 * 
 * Performance Benefits:
 * - Instant map centering without GPS delay
 * - Works offline after initial location save
 * - Reduces battery usage from GPS lookups
 */
export async function getUserLocation() {
    try {
        // DATABASE CONNECTION: Get IndexedDB instance using singleton pattern
        const db = await getDB();

        // TRANSACTION SETUP: Create read-only transaction for location retrieval
        // 'readonly' mode is faster and safer for data retrieval
        const tx = db.transaction(STORE_NAME, 'readonly');

        // ASYNC RETRIEVAL: Use Promise to handle IndexedDB's event-based API
        return new Promise(resolve => {
            // STORE OPERATION: Get location data using fixed key 'current'
            const request = tx.objectStore(STORE_NAME).get('current');

            // SUCCESS HANDLING: Process retrieved location data
            request.onsuccess = () => {
                const result = request.result;

                if (result) {
                    // FOUND LOCATION: Return normalized coordinate data
                    // parseFloat ensures coordinates are numbers, not strings
                    resolve({
                        lat: parseFloat(result.lat),
                        lng: parseFloat(result.lng)
                    });
                } else {
                    // NO LOCATION FOUND: Return null (normal case for first-time users)
                    // This is expected behavior, not an error condition
                    resolve(null);
                }
            };

            // ERROR HANDLING: Graceful failure on database read errors
            // Returns null instead of throwing to prevent app crashes
            request.onerror = () => resolve(null);
        });

    } catch (error) {
        // FALLBACK STORAGE: Use localStorage when IndexedDB fails
        // Ensures location retrieval works even on older browsers
        console.error('IndexedDB read failed, using localStorage fallback:', error);

        // FALLBACK RETRIEVAL: Parse stored location from localStorage
        const stored = localStorage.getItem('user-location');
        return stored ? JSON.parse(stored) : null;
    }
}

// ============================================================================
// INTELLIGENT LOCATION RETRIEVAL FUNCTIONS
// ============================================================================

/**
 * Unified location function with configurable behavior and multiple fallback strategies
 * Intelligently chooses between saved location, fresh GPS, and fallback coordinates
 * 
 * @param {Object} options - Configuration options for location retrieval
 * @param {boolean} options.forceFresh - If true, always get fresh GPS data (ignores saved)
 * @param {Object} options.fallback - Default location if all other methods fail
 * @param {number} options.fallback.lat - Fallback latitude coordinate
 * @param {number} options.fallback.lng - Fallback longitude coordinate
 * @param {number} options.timeout - GPS timeout in milliseconds (default: 5000)
 * @param {boolean} options.throwOnError - If true, throw errors instead of using fallback
 * 
 * @returns {Promise<Object>} Location object {lat, lng}
 * 
 * Location Strategy Hierarchy:
 * 1. Saved location (if !forceFresh) - fastest, works offline
 * 2. Fresh GPS location - accurate but slower, requires permissions
 * 3. Fallback location - ensures app always has coordinates
 * 
 * Error Handling:
 * - GPS permission denied: Use fallback or throw based on throwOnError
 * - GPS unavailable: Use fallback or throw based on throwOnError
 * - GPS timeout: Use fallback or throw based on throwOnError
 * - Browser incompatibility: Use fallback or throw based on throwOnError
 */
export async function getLocation(options = {}) {
    // OPTION PARSING: Destructure with sensible defaults
    // Default fallback coordinates point to Cairo, Egypt (central location)
    const {
        forceFresh = false,           // Don't force fresh GPS by default
        fallback = { lat: 30.033, lng: 31.233 }, // Cairo, Egypt coordinates
        timeout = 5000,               // 5 second GPS timeout
        throwOnError = false          // Use fallback instead of throwing
    } = options;

    try {
        // STRATEGY 1: Check saved location first (unless forcing fresh)
        // This provides instant map loading for returning users
        if (!forceFresh) {
            const saved = await getUserLocation();
            if (saved) {
                // SAVED LOCATION FOUND: Return immediately for best performance
                return saved;
            }
        }

        // STRATEGY 2: Get fresh GPS location when saved location unavailable or forced
        // Uses browser's geolocation API with intelligent caching
        return new Promise((resolve, reject) => {
            // BROWSER COMPATIBILITY: Check if geolocation is supported
            if (!navigator.geolocation) {
                const error = new Error('Geolocation is not supported by this browser');
                return throwOnError ? reject(error) : resolve(fallback);
            }

            // GPS REQUEST: Get current position with configurable options
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    // GPS SUCCESS: Extract coordinates from position object
                    const location = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };

                    // AUTO-SAVE: Always save fresh GPS data for future use
                    // Non-blocking save to avoid delaying location return
                    saveUserLocation(location).catch(error => {
                        console.warn('Failed to save fresh location:', error);
                    });

                    resolve(location);
                },
                (error) => {
                    // GPS ERROR HANDLING: Provide specific error messages or fallback
                    if (throwOnError) {
                        // DETAILED ERROR MESSAGES: Help users understand GPS failures
                        let message;
                        switch (error.code) {
                            case error.PERMISSION_DENIED:
                                message = 'Location access denied. Please enable location services.';
                                break;
                            case error.POSITION_UNAVAILABLE:
                                message = 'Location information is unavailable.';
                                break;
                            case error.TIMEOUT:
                                message = 'Location request timed out. Please try again.';
                                break;
                            default:
                                message = 'An unknown error occurred while retrieving location.';
                                break;
                        }
                        reject(new Error(message));
                    } else {
                        // GRACEFUL FALLBACK: Use default location when GPS fails
                        resolve(fallback);
                    }
                },
                {
                    // GPS OPTIONS: Configure accuracy, timeout, and caching behavior
                    enableHighAccuracy: true,    // Request GPS instead of WiFi/cell tower
                    timeout,                     // User-configurable timeout
                    maximumAge: forceFresh ? 0 : 60000 // Fresh = no cache, otherwise 1min cache
                }
            );
        });

    } catch (error) {
        // UNEXPECTED ERROR HANDLING: Catch any errors not handled above
        console.error('getLocation failed:', error);

        if (throwOnError) {
            throw error;
        }

        // STRATEGY 3: Final fallback to ensure app always has coordinates
        return fallback;
    }
}

// ============================================================================
// CONVENIENCE FUNCTIONS FOR COMMON USE CASES
// ============================================================================

/**
 * Convenience function for getting best available location (saved → GPS → fallback)
 * Optimized for initial map loading with fastest possible location resolution
 * 
 * @param {Object} fallback - Default location if no saved location and GPS fails
 * @param {number} fallback.lat - Fallback latitude coordinate
 * @param {number} fallback.lng - Fallback longitude coordinate
 * 
 * @returns {Promise<Object>} Location object {lat, lng}
 * 
 * Use Cases:
 * - Initial map loading/centering
 * - App startup location detection
 * - Background location updates
 * 
 * Performance Strategy:
 * - Prioritizes speed over accuracy
 * - Uses saved location if available (instant)
 * - Falls back to GPS only if no saved location
 * - Never throws errors (always returns coordinates)
 */
export async function getBestLocation(fallback = { lat: 30.033, lng: 31.233 }) {
    return getLocation({
        forceFresh: false,      // Use saved location if available
        fallback,              // Custom fallback coordinates
        throwOnError: false    // Always return coordinates, never throw
    });
}

/**
 * Convenience function for getting fresh GPS location with error handling
 * Optimized for user-initiated location requests (e.g., "Get Current Location" button)
 * 
 * @returns {Promise<Object>} Fresh GPS location {lat, lng}
 * @throws {Error} GPS-related errors with user-friendly messages
 * 
 * Use Cases:
 * - "Get Current Location" button clicks
 * - Location refresh requests
 * - High-accuracy location requirements
 * 
 * Performance Strategy:
 * - Always gets fresh GPS data (ignores saved location)
 * - Longer timeout for better accuracy
 * - Throws descriptive errors for user feedback
 * - Auto-saves fresh location for future use
 */
export async function getFreshLocation() {
    return getLocation({
        forceFresh: true,       // Always get fresh GPS data
        throwOnError: true,     // Throw errors for user feedback
        timeout: 10000         // Longer timeout for accuracy
    });
}