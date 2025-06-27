<script>
	import { onMount } from 'svelte';
	import { getBestLocation, saveUserLocation } from '$lib/utils/indexedDB.js';

	let mapDiv;
	let center = { lat: 30.033, lng: 31.233 };
	let isLoading = true;
	let locationError = null;
	let map = null;
	let marker = null;
	let googleMapsReady = false;
	let mapError = null;

	onMount(async () => {
		try {
			// Get location from IndexedDB
			const location = await getBestLocation(center);
			center = {
				lat: parseFloat(location.lat),
				lng: parseFloat(location.lng)
			};
			console.log('📍 Using location:', center);
		} catch (error) {
			console.error('Location error:', error);
			locationError = error.message;
		} finally {
			isLoading = false;
			loadGoogleMaps();
		}
	});

	async function loadGoogleMaps() {
		if (window.google && window.google.maps) {
			googleMapsReady = true;
			initMap();
			return;
		}

		const script = document.createElement('script');
		script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyAOksvFQRQimvkC8buPYh4Yx-6bc88gR-o&libraries=places,marker&callback=initMap`;
		script.async = true;
		script.defer = true;

		window.initMap = () => {
			console.log('✅ Google Maps API loaded');
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

			// Handle drag events
			marker.addListener('dragend', async (event) => {
				// Get position as serializable object
				const newLocation = {
					lat: event.latLng.lat(),
					lng: event.latLng.lng()
				};

				// Save to storage
				await saveUserLocation(newLocation);

				// Update center with numbers
				center = {
					lat: newLocation.lat,
					lng: newLocation.lng
				};
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
