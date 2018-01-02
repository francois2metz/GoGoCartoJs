import { App } from "../gogocarto";
import { AppModes, AppDataType } from "../app.module";
import { ElementsToDisplayChanged } from "../modules/elements/elements.module";

export class ElementsManager
{
  constructor()
  {
    App.ajaxModule.onNewElements.do( (result) => { this.handleNewElementsReceivedFromServer(result); });  
    App.elementsJsonModule.onNewsElementsConverted.do( (newElements)=> { App.elementsModule.addElements(newElements); });  
    App.elementsModule.onElementsToDisplayChanged.do( (ElementsToDisplayChanged)=> { this.handleElementsToDisplayChanged(ElementsToDisplayChanged); });    
  }

  checkForNewElementsToRetrieve($getFullRepresentation = false)
  {
    if (App.dataType != AppDataType.All) return;

    // console.log("checkForNewelementToRetrieve, fullRepresentation", $getFullRepresentation);
    let result = App.boundsModule.calculateFreeBounds($getFullRepresentation);
    // console.log("checkForNewelementToRetrieve, calculateBounds", result);
    if (result.status == "allRetrieved") return; // nothing to do, all elements already retrieved
    else if (result.status == "included") 
    {
      // We simulate the end of an successeful ajax request 
      App.boundsModule.updateFilledBoundsWithBoundsReceived(result.expectedFillBounds, App.currMainId,  $getFullRepresentation);
      this.handleNewElementsReceivedFromServer({'data': [], 'fullRepresentation': $getFullRepresentation});
      return;
    }    

    let freeBounds = result.freeBounds;
    let expectedFilledBounds = result.expectedFillBounds;
    if (freeBounds && freeBounds.length > 0) App.ajaxModule.getElementsInBounds(freeBounds, $getFullRepresentation, expectedFilledBounds); 
  }      

  handleNewElementsReceivedFromServer(result)
  {    
    let elementsJson = result.data;    
    
    let elements = App.elementsJsonModule.convertJsonElements(elementsJson, true, result.fullRepresentation);
    //console.log("new Elements length", newElements.length);
    
    // on add markerClusterGroup after first elements received
    if (elements.newElementsLength > 0 || App.mode == AppModes.List) 
    {
      App.elementsModule.updateElementsToDisplay(true);  
    }
  }; 

  handleElementsToDisplayChanged(result : ElementsToDisplayChanged)
  {
    let start = new Date().getTime();

    if (App.mode == AppModes.List)
    {
      App.elementListComponent.update(result.elementsToDisplay);
    }
    else
    {
      if (!App.mapComponent.isInitialized) { return;}

      App.mapComponent.markerClustererGroup.restoreUnclusters(true);

      // console.log("Display = " + result.elementsToDisplay.length + " / remove = " + result.elementsToRemove.length + " / add = " + result.newElements.length);

      // In some cases, markerCluster works faster clearing alls markers and adding them again
      if (result.elementsToRemove.length + result.newElements.length > result.elementsToDisplay.length)
      {
        App.mapComponent.clearMarkers();
        App.mapComponent.addMarkers(result.elementsToDisplay.map( (e) => e.marker.getLeafletMarker()));
      }
      else
      {
        App.mapComponent.removeMarkers(result.elementsToRemove.map( (e) => e.marker.getLeafletMarker()));
        App.mapComponent.addMarkers(result.newElements.map( (e) => e.marker.getLeafletMarker()));
      }      

      App.mapComponent.markerClustererGroup.checkForUnclestering(App.map().getBounds());
    }  

    let end = new Date().getTime();
    //console.log("ElementsToDisplayChanged in " + (end-start) + " ms");  
  };  

}