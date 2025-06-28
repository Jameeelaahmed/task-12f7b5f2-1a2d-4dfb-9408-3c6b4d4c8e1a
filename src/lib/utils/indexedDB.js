const DB_NAME = 'MapLocationDB';
const STORE_NAME = 'userLocation';
let dbInstance = null;


// function to get DB or create it if it is not created 
async function getDB() {
    // caching -> gets db for other functions and return if it is already created 
    if (dbInstance) return dbInstance;

    // Check if IndexedDB is supported
    if (!window.indexedDB) {
        throw new Error('IndexedDB is not supported in this browser');
    }

    return new Promise((resolve, reject) => {
        // async operation to open or create db
        const request = indexedDB.open(DB_NAME, 1);

        // error handler for the IndexedDB open request
        request.onerror = (event) => {
            const error = event.target.error;
            reject(new Error(`Failed to open database: ${error?.message || 'Unknown error'}`));
        };

        // success handler for when the database opens successfully
        request.onsuccess = () => {
            dbInstance = request.result;
            resolve(dbInstance);
        };

        // Database -> schema setup - runs only when database is first created or version changes
        // This is the only place where we can create object stores (tables)
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            // Create 'userLocation' object store if it doesn't exist yet
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
    });
}


export async function saveUserLocation(location) {
    try {
        // validate input exists
        if (!location) {
            throw new Error('Location object is required');
        }

        // destructuring lat and lng from location 
        const { lat, lng } = location;

        // Validate coordinates exist and are valid numbers
        if (lat == null || lng == null) {
            throw new Error('Both lat and lng are required');
        }

        const locationData = {
            lat: +lat, // used + to convert it to float instead of string 
            lng: +lng
        };

        // Check if conversion resulted in valid numbers
        if (isNaN(locationData.lat) || isNaN(locationData.lng)) {
            throw new Error('Invalid coordinates: lat and lng must be numeric');
        }

        // get db instanse
        const db = await getDB();
        // creates a transaction to interact with the database
        const tx = db.transaction(STORE_NAME, 'readwrite');
        // gets the object store table within the transaction
        const store = tx.objectStore(STORE_NAME);

        // Handle transaction errors
        return new Promise((resolve, reject) => {
            // fires if something goes wrong during the transaction
            tx.onerror = () => reject(new Error('Transaction failed'));
            // fires if the transaction is cancelled/aborted
            tx.onabort = () => reject(new Error('Transaction aborted'));
            // fires when the transaction successfully finishes
            tx.oncomplete = () => resolve();

            // Perform the put operation
            const request = store.put(locationData, 'current');
            request.onerror = () => reject(new Error('Failed to save location'));
        });
    } catch (error) {
        // fallback to local storage if indexedDb didn't work 
        console.error('Save failed, using localStorage:', error);
        localStorage.setItem('user-location', JSON.stringify(location));
    }
}

export async function getUserLocation() {
    try {
        const db = await getDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        return new Promise(resolve => {
            const request = tx.objectStore(STORE_NAME).get('current');
            request.onsuccess = () => {
                const result = request.result;
                if (result) {
                    // Found location data - return it
                    resolve({
                        lat: parseFloat(result.lat),
                        lng: parseFloat(result.lng)
                    });
                } else {
                    // No location data found - but that's OK!
                    resolve(null);
                }
            };
            request.onerror = () => resolve(null);
        });
    } catch (error) {
        // fallback to local storage if indexedDb didn't work 
        console.error('DB read failed, using localStorage:', error);
        const stored = localStorage.getItem('user-location');
        return stored ? JSON.parse(stored) : null;
    }
}

/**
 * Unified location function with configurable behavior
 * @param {Object} options - Configuration options
 * @param {boolean} options.forceFresh - If true, always get fresh GPS data
 * @param {Object} options.fallback - Default location if all else fails
 * @param {number} options.timeout - GPS timeout in milliseconds
 * @param {boolean} options.throwOnError - If true, throw errors instead of returning fallback
 */
export async function getLocation(options = {}) {
    const {
        forceFresh = false,
        fallback = { lat: 30.033, lng: 31.233 },
        timeout = 5000,
        throwOnError = false
    } = options;

    try {
        // Check saved location first (unless forcing fresh)
        if (!forceFresh) {
            const saved = await getUserLocation();
            if (saved) return saved;
        }

        // Get fresh GPS location
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                const error = new Error('Geolocation is not supported by this browser');
                return throwOnError ? reject(error) : resolve(fallback);
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const location = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    // Always save fresh GPS data
                    saveUserLocation(location);
                    resolve(location);
                },
                (error) => {
                    if (throwOnError) {
                        // Provide specific error messages when throwing
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
                        // Fallback gracefully when not throwing errors
                        resolve(fallback);
                    }
                },
                {
                    enableHighAccuracy: true,
                    timeout,
                    maximumAge: forceFresh ? 0 : 60000 // Fresh = no cache, otherwise 1min cache
                }
            );
        });
    } catch (error) {
        console.error('getLocation failed:', error);
        if (throwOnError) {
            throw error;
        }
        return fallback;
    }
}

/**
 * Convenience function for getting best available location (saved → GPS → fallback)
 * Use this for initial map loading
 */
export async function getBestLocation(fallback = { lat: 30.033, lng: 31.233 }) {
    return getLocation({ forceFresh: false, fallback, throwOnError: false });
}

/**
 * Convenience function for getting fresh GPS location
 * Use this for "Get Current Location" buttons
 */
export async function getFreshLocation() {
    return getLocation({ forceFresh: true, throwOnError: true, timeout: 10000 });
}