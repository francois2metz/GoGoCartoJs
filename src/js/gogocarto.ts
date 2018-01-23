declare var $;
declare var nunjucks, goGoCarto;

import { AppModule, AppDataType, AppModes, AppStates } from './app.module';

import { initializePickAddress } from "./components/modals/pick-address.component";
import { initializeVoting } from "./components/modals/vote.component";
import { initializeReportingAndDeleting } from "./components/modals/reporting-deleting.component";
import { initializeSendingMail } from "./components/modals/send-email.component";
import { getQueryParams } from "./utils/params";
import { Roles } from "./modules/login.module";

export var App : AppModule;

export class GoGoCartoModule
{
	private options;
	private containerSelector : string = '';
	// only for debugging
	app: AppModule;

	constructor(containerSelector : string, options = {})
	{
		this.containerSelector = containerSelector;
		this.checkForDistantConfifuration(options);
	}

	/** 
	* Set the current user role : Anonymous (0), user (1), admin (2)
	* Role is used to render specifically certain template and control
	* certain functionalities
	*/
	setUserRole($role : Roles | string) { this.app.loginModule.setRole($role); }

	setUserMail($mail : string) { this.app.loginModule.setUserMail($mail); }

	/** return the given hash to add to url so gogocarto app will open on specific element */
	getElementRouteHash($elementId, $elementName = 'find')
	{
		return this.app.routerModule.generate('show_element', { id: $elementId, name: $elementName });
	}

	showDirectoryMenu() { this.app.directoryMenuComponent.show(); }

	hideDirectoryMenu() { this.app.directoryMenuComponent.hide(); }

	private checkForDistantConfifuration(options : string|any)
	{
		if ( typeof options === 'object') this.checkForDistantTaxonomy(options);
		else $.getJSON( options, (data) =>  { this.checkForDistantTaxonomy(data); }); 
	};

	private checkForDistantTaxonomy(options : any)
	{
		let taxonomy = options.data.taxonomy;
		if (!taxonomy || !options.data.elements)
		{
			console.warn("[GoGoCarto] You must provide a taxonomy and elements dataset (both url or Json object)");
			return;
		}

		if ( typeof taxonomy === 'object') this.init(taxonomy, options);
		else $.getJSON( taxonomy, (data) =>  { this.init(data, options); }); 	
	};

	private init(taxonomy, options)
	{	
		let urlParams : any = getQueryParams(window.location.search);
		let isIframe : boolean = urlParams.iframe ? urlParams.iframe == 1 : false;
		let fullTaxonomy : boolean = urlParams.fullTaxonomy ? urlParams.fullTaxonomy == 1 : true;

		App = new AppModule(options, isIframe, fullTaxonomy);

		// only for debugging
		this.app = App;		

		App.taxonomyModule.createTaxonomyFromJson(taxonomy, options.openHours);

		let layout = App.templateModule.render('layout', 
		{ 
			mainCategory: App.taxonomyModule.mainCategory, 
			openHoursCategory: options.openHours, 
			isAdmin: App.loginModule.isAdmin(), 
			isIframe: isIframe, 
			fullTaxonomy: fullTaxonomy,
			config: App.config
		});
		   
		if ($(this.containerSelector).length == 0) console.warn('[GoGoCarto] The container "' + this.containerSelector + '" was not found');
		else $(this.containerSelector).append(layout);

		
		if (App.taxonomyModule.options.length)
		{
			let styles = App.templateModule.render('gogo-styles', {'optionList':App.taxonomyModule.options, 'config':App.config});
			let domToAddStyles = $('head').length ? $('head') : $('html');
			if (domToAddStyles.length) domToAddStyles.append(styles);
			else 	console.warn("[GoGoCarto] Cannot find Dom 'head' or 'html' to add styles");
		}		

		setTimeout( () => {		
			App.initialize();

			App.elementsModule.initialize();
			App.directoryMenuComponent.initialize();
			App.filtersComponent.initialize();
			App.boundsModule.initialize();	   
			App.elementListComponent.initialize();			
			App.searchBarComponent.initialize();			
			App.gogoControlComponent.initialize();
			App.directionsComponent.initialize();	
			App.mapControlsComponent.initialize();
			
			App.component.initialize();		
			
			initializePickAddress();
			initializeVoting();
			initializeReportingAndDeleting();
			initializeSendingMail();

			App.elementsJsonModule.loadLocalElements();

			App.routerModule.loadInitialState();
		}, 0);	   
	}
}

// fill the global variable GoGoCarto with an instance of the GoGoCarto library
goGoCarto = function(container, options) { return new GoGoCartoModule(container, options); }