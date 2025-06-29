/**
 * Google Maps utility functions
 * Handles Google Maps API loading, map initialization, and    // DYNAMIC IMPORT: Load Maps library asynchronously for better performance
    const { Map } = await window.google.maps.importLibrary('maps');
    
    // DYNAMIC IMPORT: Load Advanced Markers library (replaces deprecated Marker)
    const { AdvancedMarkerElement } = await window.google.maps.importLibrary('marker');

    // MAP CREATION: Initialize map with user-friendly configuration
    const map = new Map(mapDiv, {
        center,                    // Where to center the map initially
        zoom: 15,                 // Zoom level (1=world, 20=building level)
        gestureHandling: 'greedy', // Allow single-finger pan/zoom (mobile-friendly)
        mapId: 'DEMO_MAP_ID'      // Required for AdvancedMarkerElement
    });

    // MARKER CREATION: Add draggable marker using new AdvancedMarkerElement API
    // FIX: Replaced deprecated google.maps.Marker with AdvancedMarkerElement
    const marker = new AdvancedMarkerElement({
        position: center,      // Initial marker position
        map,                  // Associate with our map instance
        gmpDraggable: true,   // Allow user to drag marker to new location (new API property)
        title: 'Your Location' // Tooltip text on hover
    });
 * 
 * This module provides:
 * - Asynchronous Google Maps API loading with performance optimization
 * - Map and marker initialization with best practices
 * - Event handling for user interactions (marker dragging)
 * - Reactive map updates when location data changes
 * - Error handling and cleanup for robust map functionality
 */

/**
 * Load Google Maps JavaScript API with performance-optimized async loading
 * Uses dynamic script injection with callback-based loading to prevent blocking
 * Implements proper cleanup and error handling for production use
 * 
 * @param {string} apiKey - Google Maps API key from environment variables
 * @returns {Promise<void>} Resolves when API is loaded and ready to use
 * 
 * Loading Strategy:
 * - Check if already loaded (prevents duplicate loading)
 * - Validate API key exists (fail fast on configuration errors)
 * - Use async/defer script loading (non-blocking)
 * - Global callback cleanup (prevents memory leaks)
 * - Error handling for network/API failures
 */
export const loadGoogleMapsAPI = (apiKey) => {
    return new Promise((resolve, reject) => {
        // OPTIMIZATION: Check if Google Maps is already loaded
        // Prevents duplicate script injection and unnecessary network requests
        if (window.google && window.google.maps) {
            resolve();
            return;
        }

        // VALIDATION: Ensure API key is configured
        // Fail fast if environment variable is missing
        if (!apiKey) {
            reject(new Error('Google Maps API key not configured.'));
            return;
        }

        // SCRIPT INJECTION: Create script element for Google Maps API
        const script = document.createElement('script');

        // API URL with callback parameter for async loading notification
        // FIX: Add loading=async for optimal performance as recommended by Google
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async&libraries=marker&callback=initMap`;

        // PERFORMANCE: Non-blocking script loading
        script.async = true;  // Download script in parallel with page parsing
        script.defer = true;  // Execute script after HTML parsing is complete

        // CALLBACK SETUP: Global callback for when API finishes loading
        // Google Maps calls this function when ready
        window.initMap = () => {
            // CLEANUP: Remove global callback to prevent memory leaks
            delete window.initMap;
            resolve(); // Notify Promise that loading is complete
        };

        // ERROR HANDLING: Network or API loading failures
        script.onerror = () => {
            // CLEANUP: Remove callback on error
            delete window.initMap;
            reject(new Error('Failed to load Google Maps.'));
        };

        // INJECTION: Add script to document head to start loading
        document.head.appendChild(script);
    });
};

/**
 * Initialize Google Maps instance with marker using modern API patterns
 * Creates a fully functional interactive map with user location marker
 * Uses Google Maps' new library import system for better performance
 * 
 * @param {HTMLElement} mapDiv - DOM element to render the map into
 * @param {Object} center - Initial map center coordinates
 * @param {number} center.lat - Latitude for map center
 * @param {number} center.lng - Longitude for map center
 * @returns {Promise<{map: Object, marker: Object}>} Map and marker instances
 * 
 * Map Configuration:
 * - Zoom level 15 (neighborhood level detail)
 * - Greedy gesture handling (single finger pan/zoom)
 * - Draggable marker for user interaction
 * - Optimized for mobile and desktop use
 */
export const initializeMap = async (mapDiv, center) => {
    // VALIDATION: Ensure Google Maps API is loaded and available
    if (!window.google || !window.google.maps) {
        throw new Error('Google Maps library not available');
    }

    // MODERN API: Import only the Map library (performance optimization)
    // Google's new approach loads libraries on-demand rather than everything upfront
    const { Map } = await window.google.maps.importLibrary('maps');

    // DYNAMIC IMPORT: Load Advanced Markers library (replaces deprecated Marker)
    const { AdvancedMarkerElement } = await window.google.maps.importLibrary('marker');

    // MAP CREATION: Initialize map with user-friendly configuration
    const map = new Map(mapDiv, {
        center,                    // Where to center the map initially
        zoom: 15,                 // Zoom level (1=world, 20=building level)
        gestureHandling: 'greedy', // Allow single-finger pan/zoom (mobile-friendly)
        mapId: 'DEMO_MAP_ID'      // Required for AdvancedMarkerElement
    });

    // MARKER CREATION: Add draggable marker using new AdvancedMarkerElement API
    // FIX: Replaced deprecated google.maps.Marker with AdvancedMarkerElement
    const marker = new AdvancedMarkerElement({
        position: center,      // Initial marker position
        map,                  // Associate with our map instance
        gmpDraggable: true,   // Allow user to drag marker to new location (new API property)
        title: 'Your Location' // Tooltip text on hover
    });

    // RETURN: Both instances for external manipulation
    return { map, marker };
};

/**
 * Setup marker drag event handling with performance-optimized debouncing
 * Prevents excessive save operations while user is actively dragging marker
 * Implements smooth user experience with automatic location persistence
 * 
 * @param {Object} marker - Google Maps marker instance to attach events to
 * @param {Function} saveCallback - Function to call when marker position changes
 * @param {number} debounceMs - Debounce delay in milliseconds (default: 250ms)
 * 
 * Debouncing Strategy:
 * - Wait for user to stop dragging before saving
 * - Cancel previous save if user continues dragging
 * - Balance between responsiveness and performance
 * - Prevent database spam during continuous drag operations
 * 
 * Event Flow:
 * 1. User starts dragging marker
 * 2. 'dragend' event fires when drag stops
 * 3. Start debounce timer
 * 4. If another drag happens, cancel previous timer
 * 5. When timer expires, save location to database
 */
export const setupMarkerEvents = (marker, saveCallback, debounceMs = 250) => {
    // DEBOUNCE STATE: Track timeout for cancellation
    let saveTimeout;

    // EVENT LISTENER: React to marker drag completion
    // FIX: AdvancedMarkerElement uses different event handling syntax
    marker.addListener('dragend', () => {
        // DEBOUNCE: Cancel any pending save operation
        clearTimeout(saveTimeout);

        // COORDINATE EXTRACTION: Get new position from AdvancedMarkerElement
        // AdvancedMarkerElement stores position directly, not in event.latLng
        const position = marker.position;
        const newLocation = {
            lat: position.lat, // Direct property access for AdvancedMarkerElement
            lng: position.lng  // Direct property access for AdvancedMarkerElement
        };

        // DEBOUNCED SAVE: Wait for drag activity to settle before saving
        saveTimeout = setTimeout(() => {
            // CALLBACK: Notify parent component of location change
            // This typically saves to IndexedDB and updates component state
            saveCallback(newLocation);
        }, debounceMs);
    });
};

/**
 * Update map center and marker position reactively
 * Smoothly animates map to new location when component state changes
 * Prevents unnecessary updates by comparing current vs new positions
 * 
 * @param {Object} map - Google Maps instance to update
 * @param {Object} marker - Google Maps marker to reposition
 * @param {Object} center - New center coordinates to move to
 * @param {number} center.lat - Target latitude
 * @param {number} center.lng - Target longitude
 * 
 * Update Strategy:
 * - Compare current position with target position
 * - Only update if coordinates actually changed
 * - Use smooth pan animation (not instant jump)
 * - Handle coordinate conversion and validation
 * - Graceful error handling for invalid coordinates
 * 
 * Performance Considerations:
 * - Avoids unnecessary map redraws
 * - Reduces API calls by checking for actual changes
 * - Handles string/number coordinate conversion
 * - Prevents update loops in reactive systems
 */
export const updateMapPosition = (map, marker, center) => {
    try {
        // COORDINATE CONVERSION: Ensure numeric values and create LatLng object
        // Handle both string and number inputs from different data sources
        const pos = new window.google.maps.LatLng(+center.lat, +center.lng);

        // CURRENT POSITION: Get marker's existing position for comparison
        // AdvancedMarkerElement uses .position property directly
        const currentPos = marker.position;

        // CHANGE DETECTION: Only update if position actually changed
        // AdvancedMarkerElement position is a LatLng object with direct properties
        const currentLat = currentPos ? currentPos.lat : null;
        const currentLng = currentPos ? currentPos.lng : null;

        if (!currentPos || (pos.lat() !== currentLat || pos.lng() !== currentLng)) {
            // MARKER UPDATE: Move marker to new position
            // AdvancedMarkerElement uses .position property assignment
            marker.position = pos;

            // MAP ANIMATION: Smoothly pan map to center on new position
            // Uses Google's smooth animation instead of instant jump
            map.panTo(pos);
        }

    } catch (error) {
        // ERROR HANDLING: Log coordinate conversion or API errors
        // Prevents crashes from invalid coordinate data
        console.error('Map update error:', error);
    }
};
