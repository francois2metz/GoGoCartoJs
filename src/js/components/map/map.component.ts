
import { AppModule, AppStates } from "../../app.module";
import { Event } from "../../utils/event";
import { Element } from "../../classes/element.class";
import { capitalize, slugify } from "../../commons/commons";
import { GeocodeResult, RawBounds } from "../../modules/geocoder.module";
import * as Cookies from "../../utils/cookies";

/// <reference types="leaflet" />

import { App } from "../../gogocarto";
declare var $, L : any;

export class ViewPort
{
	constructor(public lat : number = 0, 
					public lng :number = 0, 
					public zoom : number = 0)
	{
		this.lat = lat || 0;
		this.lng = lng || 0;
		this.zoom = zoom || 0;
	}

	toString()
	{
		let digits = this.zoom > 14 ? 4 : 2;
		return `@${this.lat.toFixed(digits)},${this.lng.toFixed(digits)},${this.zoom}z`;
	}

	fromString(string : string)
	{
		if (!string) return null;

		let decode = string.split('@').pop().split(',');
		if (decode.length != 3) {
			console.log("ViewPort fromString erreur", string);
			return null;
		}
		this.lat = parseFloat(decode[0]);
		this.lng = parseFloat(decode[1]);
		this.zoom = parseInt(decode[2].slice(0,-1));

		//console.log("ViewPort fromString Done", this);

		return this;
	}
}


/**
* The Map Component who encapsulate the map
*
* MapComponent publics methods must be as independant as possible
* from technology used for the map (google, leaflet ...)
*
* Map component is like an interface between the map and the rest of the App
*/
export class MapComponent
{
	onMapReady = new Event<any>();
	onMapLoaded = new Event<any>();
	onClick = new Event<any>();
	onIdle = new Event<any>();

	//Leaflet map
	map_ : L.Map = null;

	markerClustererGroup = null;
	isInitialized : boolean = false;
	isMapLoaded : boolean = false;
	oldZoom = -1;
	viewport : ViewPort = null;
	// requested bounds who could not be displayed when map not initialized (see fitbounds method)
	waitingBounds : L.LatLngBounds = null;

	getMap(){ return this.map_; }; 
	getCenter() : L.LatLng { return this.viewport ? L.latLng(this.viewport.lat, this.viewport.lng) : null; }
	getBounds() : L.LatLngBounds { return this.isMapLoaded ? this.map_.getBounds() : null; }
	getZoom() { return this.map_.getZoom(); }
	getOldZoom() { return this.oldZoom; }

	init() 
	{	
		if (this.isInitialized) 
		{
			this.resize();
			return;
		}

		// payant			
		let mapbox = L.tileLayer('https://api.mapbox.com/styles/v1/mapbox/streets-v10/tiles/256/{z}/{x}/{y}?access_token=pk.eyJ1Ijoic2ViYWxsb3QiLCJhIjoiY2l4MGtneGVjMDF0aDJ6cWNtdWFvc2Y3YSJ9.nIZr6G2t08etMzft_BHHUQ');
		let mapboxlight = L.tileLayer('https://api.mapbox.com/styles/v1/mapbox/light-v9/tiles/256/{z}/{x}/{y}?access_token=pk.eyJ1Ijoic2ViYWxsb3QiLCJhIjoiY2l4MGtneGVjMDF0aDJ6cWNtdWFvc2Y3YSJ9.nIZr6G2t08etMzft_BHHUQ');
		
		// gratuit (je crois)
		let cartodb = L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png'); // pas mal; très clair. 5ko
		let hydda = L.tileLayer('https://{s}.tile.openstreetmap.se/hydda/full/{z}/{x}/{y}.png'); // pas mal ! 20ko
		let wikimedia = L.tileLayer('https://maps.wikimedia.org/osm-intl/{z}/{x}/{y}.png'); // sympa mais version démo je crois
		let monochrome = L.tileLayer('https://www.toolserver.org/tiles/bw-mapnik/{z}/{x}/{y}.png'); // ça passe
		let lyrk  = L.tileLayer('https://tiles.lyrk.org/ls/{z}/{x}/{y}?apikey =982c82cc765f42cf950a57de0d891076'); // pas mal; mais zomm max 16. 20ko
		let osmfr = L.tileLayer('https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png');
		let stamen = L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/toner-lite/{z}/{x}/{y}.png');	
		let stamenTerrain = L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/terrain/{z}/{x}/{y}.png');		
		let stamenWaterColor = L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/watercolor/{z}/{x}/{y}.png');			
		let openriver = L.tileLayer('https://{s}.tile.openstreetmap.fr/openriverboatmap/{z}/{x}/{y}.png');
		let thunderforest = L.tileLayer('https://{s}.tile.thunderforest.com/outdoors/{z}/{x}/{y}.png'); // pas très joli		

		let baseLayers = {
			'hydda' : hydda,
			'mapbox' : mapbox, 
			'mapboxlight' : mapboxlight, 
			'cartodb' : cartodb, 			
			'wikimedia' : wikimedia,
			'monochrome' : monochrome, 
			'lyrk'  : lyrk, 
			'osmfr' : osmfr, 
			// 'stamen' : stamen,
			// 'stamenTerrain' : stamenTerrain,
			'WaterColor' : stamenWaterColor,
			//'openriver' : openriver,  
			'thunderforest' : thunderforest, 
			'Pas de fond' : L.tileLayer(''),
		};

		// Get defaultBaseLayer from Cookie if possible
		let baseLayerId = Cookies.readCookie('defaultBaseLayer');
		let defaultBaseLayer = baseLayers.hasOwnProperty(baseLayerId) ? baseLayers[baseLayerId] : baseLayers.hydda;

		this.map_ = L.map('directory-content-map', {
		    zoomControl: false,
		    layers: [defaultBaseLayer]
		});

		this.markerClustererGroup = L.markerClusterGroup({
		    spiderfyOnMaxZoom: true,
		    showCoverageOnHover: false,
		    zoomToBoundsOnClick: true,
		    spiderfyOnHover: false,
		    spiderfyMaxCount: 10,
		    spiderfyDistanceMultiplier: 1.1,
		    chunkedLoading: true,
		    animate: false,
		    maxClusterRadius: (zoom) =>
		    {
		    	if (zoom > 10) return 50;
		    	if (zoom > 7) return 75;
		    	else return 100;
		    }
		});

		this.markerClustererGroup.on('spiderfied', (clusters, markers) =>
		{
			App.elementModule.updateElementsIcons(true);
		});

		this.addMarkerClusterGroup();		

		L.control.zoom({position:'topright'}).addTo(this.map_);		

		L.control.layers(baseLayers, {}, {position:'topright', collapsed: false}).addTo(this.map_);		

		$('#directory-content-map #change-layers').click( (e) =>
		{
			$('#directory-content-map #change-layers').hideTooltip();
			this.showControlLayers();
			e.preventDefault();
			e.stopPropagation();
		});

		$('#directory-content-map #close-layers-panel').click( (e) =>
		{		
			this.hideControlLayers();
			e.preventDefault();
			e.stopPropagation();
		});	

		this.map_.on('click', (e) => { this.onClick.emit(); });
		this.map_.on('moveend', (e) => 
		{ 
			let visibleMarkersLength = $('.leaflet-marker-icon:visible').length;
			let ratio;
			if (this.map_.getZoom() == this.oldZoom)
			{
				ratio = 0.5/Math.pow((visibleMarkersLength/100),2);
				ratio = Math.min(0.5, ratio);
				ratio = Math.round(ratio*10)/10;
			}
			else
			{
				ratio = 0;
			}			

			this.oldZoom = this.map_.getZoom();
			this.updateViewPort();

			App.boundsModule.extendBounds(ratio, this.map_.getBounds());
			this.onIdle.emit(); 
		});
		this.map_.on('load', (e) => 
		{ 
			this.isMapLoaded = true; 
			this.onMapLoaded.emit(); 

			// listen for base layer selection, to store value in cookie
			$('#directory-content-map .leaflet-control-layers-selector').change( function(e) 
			{		
				Cookies.createCookie('defaultBaseLayer', $(this).siblings('span').text());
			});
		});

		this.resize();		

		this.isInitialized = true;

		// if we began with List Mode, when we initialize map
		// there is already an address geocoded or a viewport defined
		if (this.waitingBounds) this.fitBounds(this.waitingBounds, false);
		else if (this.viewport) setTimeout( () => { this.setViewPort(this.viewport); },200);
		//console.log("map init done");
		this.onMapReady.emit();
	};

	addMarkerClusterGroup() { this.map_.addLayer(this.markerClustererGroup); }

	resize()
	{
		//console.log("Resize, curr viewport :");
		// Warning !I changed the leaflet.js file library myself
		// because the options doesn't work properly
		// I changed it to avoi panning when resizing the map
		// be careful if updating the leaflet library this will
		// not work anymore
		if (this.map_) this.map_.invalidateSize(false);

	}

	addMarker(marker : L.Marker)
	{
		this.markerClustererGroup.addLayer(marker);
	}

	addMarkers(markers : L.Marker[])
	{
		if (this.markerClustererGroup) this.markerClustererGroup.addLayers(markers);
	}

	removeMarker(marker : L.Marker)
	{
		this.markerClustererGroup.removeLayer(marker);
	}

	removeMarkers(markers : L.Marker[])
	{
		if (this.markerClustererGroup) this.markerClustererGroup.removeLayers(markers);
	}

	clearMarkers()
	{
		if (this.markerClustererGroup) this.markerClustererGroup.clearLayers();
	}

	fitElementsBounds(elements : Element[])
	{
		let bounds = L.latLngBounds();
		for(let element of elements) bounds.extend(element.position);
		this.fitBounds(bounds);
	}

	// fit map view to bounds
	fitBounds(bounds : L.LatLngBounds, animate : boolean = true)
	{
		//console.log("fitbounds", bounds);
		if (!this.isInitialized)
		{
			this.waitingBounds = bounds;
			return;
		}
		if (this.isMapLoaded && animate) App.map().fitBounds(bounds);
		else App.map().fitBounds(bounds);
	}		

	fitDefaultBounds()
	{
		this.fitBounds(App.boundsModule.maxBounds);
	}

	panToLocation(location : L.LatLng, zoom?, animate : boolean = true)
	{
		zoom = zoom || this.getZoom() || 12;
		console.log("panTolocation", location);

		if (this.isMapLoaded && animate) this.map_.setView(location, zoom);
		else this.map_.setView(location, zoom);
	};

	// the actual displayed map radius (distance from croner to center)
	mapRadiusInKm() : number
	{
		if (!this.isMapLoaded) return 0;
		return Math.floor(this.map_.getBounds().getNorthEast().distanceTo(this.map_.getCenter()) / 1000);
	}

	// distance from last saved location to a position
	distanceFromLocationTo(position : L.LatLng)
	{
		if (!App.geocoder.getLocation()) return null;
		return App.geocoder.getLocation().distanceTo(position) / 1000;
	}

	contains(position : L.LatLngExpression) : boolean
	{
		if (position)
		{
			 return this.map_.getBounds().contains(position);
		}
		console.log("MapComponent->contains : map not loaded or element position undefined");
		return false;		
	}

	extendedContains(position : L.LatLngExpression) : boolean
	{
		if (this.isMapLoaded && position)
		{
			 return App.boundsModule.extendedBounds.contains(position);
		}
		//console.log("MapComponent->contains : map not loaded or element position undefined");
		return false;
	}

	updateViewPort()
	{
		if (!this.viewport) this.viewport = new ViewPort();
		this.viewport.lat =  this.map_.getCenter().lat;
		this.viewport.lng =  this.map_.getCenter().lng;
		this.viewport.zoom = this.getZoom();
	}	

	setViewPort($viewport : ViewPort, $panMapToViewport : boolean = true)
	{		
		if (this.map_ && $viewport && $panMapToViewport)
		{
			//console.log("setViewPort", $viewport);
			let timeout = App.state == AppStates.ShowElementAlone ? 500 : 0;
			setTimeout( () => { this.map_.setView(L.latLng($viewport.lat, $viewport.lng), $viewport.zoom) }, timeout);
		}
		this.viewport = $viewport;
	}

	hidePartiallyClusters()
	{
		$('.marker-cluster').addClass('halfHidden');
	}

	showNormalHiddenClusters()
	{
		$('.marker-cluster').removeClass('halfHidden');
	}

	showControlLayers()
	{
		$('#directory-content-map .leaflet-control-layers').show();
		$('#directory-content-map #close-layers-panel').show();
	}

	hideControlLayers()
	{
		$('#directory-content-map .leaflet-control-layers').hide();
		$('#directory-content-map #close-layers-panel').hide();	
	}
}
