<script>
	// Svelte lifecycle imports
	import { onMount } from 'svelte';

	// Google Maps utility functions - handles API loading, map initialization, and interactions
	import {
		loadGoogleMapsAPI, // Loads Google Maps JavaScript API with performance optimization
		initializeMap, // Creates map and marker instances with proper configuration
		setupMarkerEvents, // Sets up drag event listeners with debounced saving
		updateMapPosition // Updates map center and marker position reactively
	} from '$lib/utils/mapUtils.js';

	// Location utility functions - handles GPS access, validation, and formatting
	import {
		getLocationWithFallback, // Smart location retrieval with GPS and saved location fallback
		formatLocation // Formats coordinates for display (e.g., "Lat: 30.033, Lng: 31.233")
	} from '$lib/utils/locationUtils.js';

	// External CSS file containing all component styles
	import '$lib/styles/Map.css';

	// ============================================================================
	// COMPONENT STATE VARIABLES
	// ============================================================================

	// DOM reference to the map container element (bound with bind:this)
	let mapDiv;

	// Current map center coordinates - defaults to Cairo, Egypt
	let center = { lat: 30.033, lng: 31.233 };

	// Loading state - true while getting initial location from IndexedDB
	let isLoading = true;

	// Error message for location-related errors (GPS access, saved location, etc.)
	let locationError = null;

	// Google Maps instance - null until map is successfully initialized
	let map = null;

	// Google Maps marker instance - represents user's location on the map
	let marker = null;

	// Flag indicating whether Google Maps API has been loaded and is ready to use
	let googleMapsReady = false;

	// Error message for map-related errors (API loading, initialization, etc.)
	let mapError = null;

	// Flag to prevent multiple simultaneous location requests when user clicks location button
	let isGettingLocation = false;

	// ============================================================================
	// DYNAMIC IMPORTS - Loaded only when needed for performance
	// ============================================================================

	// These functions are loaded dynamically to reduce initial bundle size
	let getLocation; // Function to get location from IndexedDB or GPS
	let saveUserLocation; // Function to save user's location to IndexedDB

	// ============================================================================
	// COMPONENT INITIALIZATION
	// ============================================================================

	/**
	 * Component lifecycle - runs when component is first mounted to the DOM
	 * Handles:
	 * 1. Dynamic import of IndexedDB utilities (performance optimization)
	 * 2. Loading saved location from IndexedDB
	 * 3. Setting initial map center
	 * 4. Starting Google Maps API loading process
	 */
	onMount(async () => {
		try {
			// Dynamically import IndexedDB utilities to reduce initial bundle size
			// This is loaded only when the component mounts, not during app startup
			const locationUtils = await import('$lib/utils/indexedDB.js');
			getLocation = locationUtils.getLocation;
			saveUserLocation = locationUtils.saveUserLocation;

			// Attempt to get saved location from IndexedDB
			// Falls back to default center (Cairo) if no saved location exists
			const location = await getLocation({
				forceFresh: false, // Use saved location if available
				fallback: center, // Use Cairo as fallback
				throwOnError: false // Don't throw errors, use fallback instead
			});

			// Update center with retrieved location, ensuring numeric values
			center = { lat: +location.lat, lng: +location.lng };
		} catch (error) {
			// If location retrieval fails, store error message for display
			locationError = error.message;
		} finally {
			// Always stop loading spinner and start Google Maps loading
			isLoading = false;

			// Use requestIdleCallback for non-blocking Google Maps loading
			// This defers loading until the browser is idle, improving initial page performance
			requestIdleCallback(loadGoogleMaps);
		}
	});

	// ============================================================================
	// GOOGLE MAPS LOADING AND INITIALIZATION
	// ============================================================================

	/**
	 * Loads Google Maps JavaScript API and initializes the map
	 * Uses performance-optimized loading strategy to minimize blocking
	 */
	async function loadGoogleMaps() {
		try {
			// Get API key from environment variables
			const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

			// Load Google Maps API using utility function
			// This handles script injection, callback setup, and error handling
			await loadGoogleMapsAPI(apiKey);

			// Mark API as ready and initialize the map
			googleMapsReady = true;
			initMap();
		} catch (error) {
			// Store error message if API loading fails
			mapError = error.message;
		}
	}

	/**
	 * Initializes the Google Maps instance and marker
	 * Only runs when API is loaded, DOM element is available, and initial loading is complete
	 */
	async function initMap() {
		// Guard clause - ensure all prerequisites are met
		if (!googleMapsReady || !mapDiv || isLoading) return;

		try {
			// Use utility function to create map and marker with optimized settings
			const result = await initializeMap(mapDiv, center);
			map = result.map;
			marker = result.marker;

			// Setup marker drag events with automatic saving to IndexedDB
			// The callback is called with debouncing (250ms delay) when marker is dragged
			setupMarkerEvents(marker, async (newLocation) => {
				// Save new location to IndexedDB for persistence
				await saveUserLocation(newLocation);
				// Update component state to trigger reactive updates
				center = newLocation;
			});
		} catch (error) {
			console.error('Map initialization error:', error);
			mapError = 'Failed to initialize map. Please try refreshing the page.';
		}
	}

	// ============================================================================
	// USER INTERACTION HANDLERS
	// ============================================================================

	/**
	 * Gets user's current location using GPS
	 * Called when user clicks the floating location button
	 * Implements proper loading states and error handling
	 */
	async function getCurrentLocation() {
		// Prevent multiple simultaneous requests
		if (isGettingLocation) return;

		// Set loading state and clear any previous errors
		isGettingLocation = true;
		mapError = null;

		try {
			// Use location utility with fallback strategy
			const newLocation = await getLocationWithFallback(getLocation, {
				forceFresh: true, // Force GPS location, don't use saved
				throwOnError: true, // Throw errors instead of using fallback
				timeout: 10000 // 10 second timeout for GPS request
			});

			// Update map center - this will trigger reactive map update
			center = newLocation;
		} catch (error) {
			// Display error message to user
			mapError = error.message;
		} finally {
			// Always clear loading state
			isGettingLocation = false;
		}
	}

	// ============================================================================
	// REACTIVE UPDATES
	// ============================================================================

	/**
	 * Reactive statement - automatically runs when map, marker, or center changes
	 * Updates the map view and marker position when center coordinates change
	 * This ensures the map stays in sync with the component state
	 */
	$: if (map && marker && center) {
		updateMapPosition(map, marker, center);
	}
</script>

<!-- 
	COMPONENT TEMPLATE
	Renders different UI states based on loading, error, and map readiness conditions
	Uses Svelte's reactive conditional rendering with {#if} blocks
-->

<!-- LOADING STATE: Shown while getting initial location from IndexedDB -->
{#if isLoading}
	<div class="loading-container">
		<!-- Animated CSS spinner for visual feedback -->
		<div class="loading-spinner"></div>
		<p>Getting your location...</p>
	</div>

	<!-- ERROR STATE: Shown when location or map errors occur -->
{:else if locationError || mapError}
	<div class="error-container">
		<!-- Display error message with warning icon -->
		<p>⚠️ {locationError || mapError}</p>
		<!-- Show current coordinates using utility function for consistent formatting -->
		<p>{formatLocation(center)}</p>
	</div>

	<!-- MAIN MAP STATE: Shown when loading is complete and no errors -->
{:else}
	<div class="map-container">
		<!-- 
			Map container element - bound to mapDiv variable for DOM manipulation
			This is where the Google Maps instance will be rendered
		-->
		<div bind:this={mapDiv} class="map-view"></div>

		<!-- 
			Floating location button - positioned absolutely over the map
			Allows user to get their current GPS location
		-->
		<button
			class="location-button"
			on:click={getCurrentLocation}
			disabled={isGettingLocation}
			aria-label="Get current location"
			title="Get current location"
		>
			<!-- BUTTON LOADING STATE: Show spinner while getting GPS location -->
			{#if isGettingLocation}
				<div class="button-spinner"></div>
				<!-- Screen reader text for accessibility -->
				<span class="visually-hidden">Getting location...</span>

				<!-- BUTTON NORMAL STATE: Show location pin icon -->
			{:else}
				📍
				<!-- Screen reader text for accessibility -->
				<span class="visually-hidden">Get current location</span>
			{/if}
		</button>
	</div>
{/if}
