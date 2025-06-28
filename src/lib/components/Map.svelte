<script>
	import { onMount } from 'svelte';
	import { getBestLocation, saveUserLocation } from '$lib/utils/indexedDB.js';

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
			// Get geolocation saved in indexed db
			const location = await getBestLocation(center);
			const { lat, lng } = location;
			center = {
				lat: +lat,
				lng: +lng
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
	<div bind:this={mapDiv} class="map-view"></div>
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

	.map-fallback {
		margin-top: 20px;
		padding: 15px;
		background: white;
		border-radius: 8px;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
		font-size: 0.9em;
	}
</style>
