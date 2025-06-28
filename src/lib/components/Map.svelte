<script>
	import { onMount } from 'svelte';
	import {
		getBestLocation,
		saveUserLocation,
		getFreshLocation,
		getLocation
	} from '$lib/utils/indexedDB.js';

	let mapDiv; // DOM reference to the map container
	let center = { lat: 30.033, lng: 31.233 }; // Default location (Cairo) (Fallback location)
	let isLoading = true; // Show loading spinner while initializing
	let locationError = null; // Show loading spinner while initializing
	let map = null; // Show loading spinner while initializing
	let marker = null; // Will hold draggable marker
	let googleMapsReady = false; // Whether Google Maps SDK is loaded
	let mapError = null; // Whether Google Maps SDK is loaded

	//**
	// why on mount?
	// because map needs to find its refrence div to exist in the dom before initialization
	// so using on mount makes sure component is fully mounted and all dom bindings are
	// established before codee runs */
	onMount(async () => {
		try {
			// Get best available location (saved → GPS → fallback)
			const location = await getLocation({
				forceFresh: false,
				fallback: center,
				throwOnError: false
			});

			center = {
				lat: +location.lat,
				lng: +location.lng
			};
			console.log('Using location:', center);
		} catch (error) {
			console.error('Location error:', error);
			locationError = error.message;
		} finally {
			isLoading = false;
			loadGoogleMaps();
		}
	});

	// loads Google Maps JavaScript API only when needed
	async function loadGoogleMaps() {
		// check if  google object and google map is already there so it avoids loading it twice
		if (window.google && window.google.maps) {
			googleMapsReady = true;
			// if already loaded, immediately initialize the map
			initMap();
			return;
		}

		// Check if API key is configured
		const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
		if (!apiKey) {
			mapError = 'Google Maps API key not configured. Please check your .env file.';
			console.error('VITE_GOOGLE_MAPS_API_KEY not found in environment variables');
			return;
		}

		// create script element and append it to head
		const script = document.createElement('script');
		script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker&callback=initMap`;
		// async = downloads in background, defer = waits for DOM ready
		script.async = true;
		script.defer = true;

		window.initMap = () => {
			console.log('Google Maps API loaded');
			googleMapsReady = true;
			initMap();
		};

		script.onerror = () => {
			mapError = 'Failed to load Google Maps. Please check your internet connection.';
			console.error('Google Maps script failed to load');
		};

		document.head.appendChild(script);
	}

	async function initMap() {
		if (!googleMapsReady || !mapDiv || isLoading) return;
		if (!window.google || !window.google.maps) {
			mapError = 'Google Maps library not available';
			return;
		}

		try {
			const { Map } = await google.maps.importLibrary('maps');
			const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');

			// Create map instance
			map = new Map(mapDiv, {
				center,
				zoom: 15,
				mapId: 'DEMO_MAP_ID',
				gestureHandling: 'greedy'
			});

			// Create draggable marker
			marker = new AdvancedMarkerElement({
				position: new google.maps.LatLng(center.lat, center.lng),
				map,
				gmpDraggable: true,
				title: 'Your Location'
			});

			// debounce

			let saveTimeout;

			marker.addListener('dragend', (event) => {
				clearTimeout(saveTimeout); // 🧽 Cancel previous save if not completed

				const newLocation = {
					lat: event.latLng.lat(),
					lng: event.latLng.lng()
				};

				saveTimeout = setTimeout(async () => {
					await saveUserLocation(newLocation); // 💾 Save only once after delay
					center = newLocation;
				}, 250); // Wait 250ms after the last drag
			});

			console.log('🗺️ Map initialized at:', center);
		} catch (error) {
			console.error('Map initialization error:', error);
			mapError = 'Failed to initialize map. Please try refreshing the page.';
		}
	}

	// Get user's current location via GPS - uses getFreshLocation for real-time position
	let isGettingLocation = false;

	async function getCurrentLocation() {
		isGettingLocation = true;
		mapError = null; // Clear any previous errors

		try {
			// Get fresh GPS location with error throwing
			const newLocation = await getLocation({
				forceFresh: true,
				throwOnError: true,
				timeout: 10000
			});

			// Update map center (location is already saved by getLocation)
			center = newLocation;
			console.log('📍 Updated to current location:', newLocation);
		} catch (error) {
			console.error('Failed to get current location:', error);
			mapError = error.message; // Use the specific error message from getLocation
		} finally {
			isGettingLocation = false;
		}
	}

	// Reactive update when center changes
	$: if (map && marker && center) {
		try {
			// Ensure we have a LatLng object
			const position = new google.maps.LatLng(parseFloat(center.lat), parseFloat(center.lng));

			marker.position = position;
			map.panTo(position);
		} catch (error) {
			console.error('Map update error:', error);
		}
	}
</script>

{#if isLoading}
	<div class="loading-container">
		<div class="loading-spinner"></div>
		<p>Getting your location...</p>
	</div>
{:else if locationError || mapError}
	<div class="error-container">
		<p>⚠️ {locationError || mapError}</p>
		<p>Using default location instead.</p>
		<div class="map-fallback">
			<p>Map cannot be displayed</p>
			<p>Lat: {center.lat.toFixed(6)}, Lng: {center.lng.toFixed(6)}</p>
		</div>
	</div>
{:else}
	<div class="map-container">
		<div bind:this={mapDiv} class="map-view"></div>

		<!-- Current Location Button -->
		<button
			class="location-button"
			on:click={getCurrentLocation}
			disabled={isGettingLocation}
			title="Get current location"
		>
			{#if isGettingLocation}
				<div class="button-spinner"></div>
			{:else}
				📍
			{/if}
		</button>
	</div>
{/if}

<style>
	.loading-container,
	.error-container {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		height: 100vh;
		font-family: Arial, sans-serif;
		text-align: center;
		padding: 20px;
	}

	.loading-container {
		background-color: #f5f5f5;
	}

	.error-container {
		background-color: #fff3cd;
		border: 1px solid #ffeaa7;
		color: #856404;
	}

	.loading-spinner {
		width: 40px;
		height: 40px;
		border: 4px solid #e3e3e3;
		border-top: 4px solid #3498db;
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin-bottom: 16px;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	.map-view {
		width: 100%;
		height: 100vh;
		background-color: #e9ecef;
	}

	.map-container {
		position: relative;
		width: 100%;
		height: 100vh;
	}

	.location-button {
		position: absolute;
		top: 20px;
		right: 20px;
		width: 50px;
		height: 50px;
		border-radius: 50%;
		border: 2px solid #fff;
		background: #4285f4;
		color: white;
		font-size: 20px;
		cursor: pointer;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
	}

	.location-button:hover:not(:disabled) {
		background: #3367d6;
		transform: scale(1.05);
	}

	.location-button:disabled {
		opacity: 0.7;
		cursor: not-allowed;
		transform: none;
	}

	.button-spinner {
		width: 20px;
		height: 20px;
		border: 2px solid transparent;
		border-top: 2px solid white;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	.map-fallback {
		margin-top: 20px;
		padding: 15px;
		background: white;
		border-radius: 8px;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
		font-size: 0.9em;
	}
</style>
