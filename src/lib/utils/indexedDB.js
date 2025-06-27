const DB_NAME = 'MapLocationDB';
const STORE_NAME = 'userLocation';
let dbInstance = null;

async function getDB() {
    if (dbInstance) return dbInstance;

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);

        request.onerror = () => reject('Failed to open DB');

        request.onsuccess = () => {
            dbInstance = request.result;
            resolve(dbInstance);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
    });
}

export async function saveUserLocation(location) {
    try {
        // Ensure we have a plain object with numbers
        const serializable = {
            lat: parseFloat(location.lat),
            lng: parseFloat(location.lng)
        };

        const db = await getDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(serializable, 'current');
        return new Promise(resolve => tx.oncomplete = resolve);
    } catch (error) {
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
                    // Ensure numeric values
                    resolve({
                        lat: parseFloat(result.lat),
                        lng: parseFloat(result.lng)
                    });
                } else {
                    resolve(null);
                }
            };
            request.onerror = () => resolve(null);
        });
    } catch (error) {
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
                () => resolve(fallback),
                { enableHighAccuracy: true, timeout: 5000 }
            );
        });
    } catch (error) {
        console.error('getBestLocation failed:', error);
        return fallback;
    }
}