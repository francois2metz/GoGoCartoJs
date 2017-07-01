declare var $;
declare var nunjucks, goGoCarto;

import { AppModule, AppDataType, AppModes, AppStates } from './app.module';

import { HistoryState } from "./modules/history.module";
import { initializeAppInteractions } from "./app-interactions";
import { initializeElementMenu } from "./components/element-menu.component";
import { initializeVoting } from "./components/vote.component";
import { initializeReportingAndDeleting } from "./components/reporting-deleting.component";
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
	setUserRole($role : Roles | string)
	{
		this.app.loginModule.setRole($role);
	}

	/** return the given hash to add to url so gogocarto app will open on specific element */
	getElementRouteHash($elementId, $elementName = 'find')
	{
		return this.app.routerModule.generate('show_element', { id: $elementId, name: $elementName });
	}

	private checkForDistantConfifuration(options : string|any)
	{
		if ( typeof options === 'object')
		{
			this.checkForDistantTaxonomy(options);
		}
		else
		{
		 	$.getJSON( options, (data) =>  { this.checkForDistantTaxonomy(data); }); 
		}		
	};

	private checkForDistantTaxonomy(options : any)
	{
		if (!options.taxonomy)
		{
			console.warn("[GoGoCarto] You must provide a taxonomy (url or Json object)");
			return;
		}

		if ( typeof options.taxonomy === 'object')
		{
			this.init(options.taxonomy, options);
		}
		else
		{
		 	$.getJSON( options.taxonomy, (data) =>  { this.init(data, options); }); 
		}		
	};

	private init(taxonomy, options)
	{	
		App = new AppModule(options); 
		// only for debugging
		this.app = App;

		let layout = App.templateModule.render('layout', { mainCategory: taxonomy, openHoursCategory: options.openHours, isAdmin: App.loginModule.isAdmin() });
		   
		if ($(this.containerSelector).length == 0) console.warn('[GoGoCarto] The container "' + this.containerSelector + '" was not found');
		else $(this.containerSelector).append(layout);

		App.categoryModule.createCategoriesFromJson(taxonomy, options.openHours);
		if (App.categoryModule.options.length)
		{
			let styles = App.templateModule.render('categories-styles', {'optionList':App.categoryModule.options});
			let domToAddStyles = $('head').length ? $('head') : $('html');
			if (domToAddStyles.length) domToAddStyles.append(styles);
			else 	console.warn("[GoGoCarto] Cannot find Dom 'head' or 'html' to add styles");
		}

		setTimeout( () => {
			App.elementModule.initialize();
			App.directoryMenuComponent.initialize();
			App.boundsModule.initialize();	   
			App.elementListComponent.initialize();
			App.routerModule.loadInitialState();
			App.searchBarComponent.initialize();

			initializeAppInteractions();
			initializeElementMenu();
			initializeVoting();
			initializeReportingAndDeleting();
		}, 0);	   
	}
}

// fill the global variable GoGoCarto with an instance of the GoGoCarto library
goGoCarto = function(container, options) { return new GoGoCartoModule(container, options); }