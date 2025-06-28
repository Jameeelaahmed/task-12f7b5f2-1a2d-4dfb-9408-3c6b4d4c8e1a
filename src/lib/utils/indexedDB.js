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

export async function getBestLocation(fallback = { lat: 30.033, lng: 31.233 }) {
    try {
        const saved = await getUserLocation();
        if (saved) return saved;

        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                return resolve(fallback);
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const location = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    saveUserLocation(location);
                    resolve(location);
                },
                // If GPS fails, use Cairo, Egypt as fallback
                () => resolve(fallback),
                //**
                // requests the most accurate location possible,
                //  Uses GPS satellite instead of just WiFi/cell tower triangulation
                // time for maximum time to wait for location  */
                { enableHighAccuracy: true, timeout: 5000 }
            );
        });
    } catch (error) {
        // if geolocation failed or get user locatiom ... it will return this fallback 
        console.error('getBestLocation failed:', error);
        return fallback;
    }
}