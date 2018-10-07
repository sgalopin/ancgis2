/*global ol*/

// ol import
import VectorSource from 'ol/source/Vector.js'
import VectorEventType from 'ol/source/VectorEventType.js'
import VectorLayer from 'ol/layer/Vector.js'
import Style from 'ol/style/Style.js'
import Fill from 'ol/style/Fill.js'
import Stroke from 'ol/style/Stroke.js'
import Text from 'ol/style/Text.js'
import Circle from 'ol/geom/Circle.js'
import WMTSTileGrid from 'ol/tilegrid/WMTS.js'
import WMTSSource from 'ol/source/WMTS.js'
import TileLayer from 'ol/layer/Tile.js'
import Attribution from 'ol/control/Attribution.js'
import ZoomSlider from 'ol/control/ZoomSlider.js'
import ScaleLine from 'ol/control/ScaleLine.js'
import MousePosition from 'ol/control/MousePosition.js'
import {format as coordinateFormat} from 'ol/coordinate.js'
import View from 'ol/View.js'
import {get as olProjGet} from 'ol/proj.js'
import {getWidth as olExtentGetWidth} from 'ol/extent.js'

// Local import
import Sidbm from "../dbms/SyncIdbManager.js"
import ExtendedMap from '../../ol/ExtendedMap.js'
import ExtendedGeoJSON from '../../ol/format/ExtendedGeoJSON.js'
import PeriodSwitcher from '../../ol/control/PeriodSwitcher.js'
import PeriodSwitcherEvent from '../../ol/control/PeriodSwitcherEvent.js'
import PeriodSwitcherEventType from '../../ol/control/PeriodSwitcherEventType.js'
import ZoneDAO from "../dao/ZoneDAO.js";
import HiveDAO from "../dao/HiveDAO.js";
import ZoneForm from "../form/zone.js";
import HiveForm from "../form/hive.js";

/**
 * Map builder.
 */
export default async function() {

  let idbm = await Sidbm;
  let zoneForm = await ZoneForm();
  let hiveForm = await HiveForm();
  let zoneDAO = new ZoneDAO(idbm);
  let hiveDAO = new HiveDAO(idbm);
  let extendedGeoJSON = new ExtendedGeoJSON();

  async function featuresToGeoJson(collection) {
      return extendedGeoJSON.readFeatures({
        "type": "FeatureCollection",
        "crs": {
          "type": "name",
          "properties": {
            "name": "EPSG:3857"
          }
        },
        "features": await idbm.readAll(collection)
      });
  }

  // Hives layer
  var hivesLayerSource = new VectorSource({
    wrapX: false,
    format: extendedGeoJSON
  });
  var hivesLayerName = "hivesLayer";
  // Set the default values and save the new hive
  hivesLayerSource.on(VectorEventType.ADDFEATURE, function(e){
    e.feature.setProperties({
      layerName: hivesLayerName,
      dao: hiveDAO,
      form: hiveForm
    }, true);
    if ( typeof e.feature.getId() === "undefined" ) {
      hiveDAO.createFeature(e.feature);
    }
  });
  // Add the features from the local database
  hivesLayerSource.addFeatures(await featuresToGeoJson("hives"));
  var hivesLayer = new VectorLayer({
    name: hivesLayerName,
    source: hivesLayerSource,
    style(feature) {
      var ppts = feature.getProperties();
      return new Style({
        fill: new Fill({
          color: "red"
        }),
        stroke: new Stroke({
          color: "black",
          width: 2
        }),
        text: new Text({
          text: "N°" + ppts.registrationNumber
        })
      });
    }
  });

  var vegetationsLayerSource = new VectorSource({
    wrapX: false,
    format: extendedGeoJSON
  });
  var vegetationsLayerName = "vegetationsLayer";
  var vegetationsLayer = new VectorLayer({
    name: vegetationsLayerName,
    source: vegetationsLayerSource,
    style(feature) {
      var ppts = feature.getProperties();

      // Style stroke and fill
      var styles = {
        "Polygon": new Style({
          stroke: new Stroke({
            color: "black",
            width: 2
          }),
          fill: new Fill({
            color: "rgba(255, 255, 0, 0.1)"
          })
        }),
        "Circle": new Style({
          stroke: new Stroke({
            color: "black",
            //lineDash: [4],
            width: 2
          }),
          fill: new Fill({
            color: "rgba(0,255,0,0.1)"
          })
        })
      };

      // Style text
      if(ppts.flore) {
        var text = "";
        ppts.flore.forEach(function(species, i) {
          if (i !== 0) {
            text += "\n\n";
          }
          text += species.taxon.vernacularName + "\n"
          + species.taxon.periods + "\n"
          + species.recovery + "%";
        });
        text = new Text({ text });
        styles.Polygon.setText(text);
        styles.Circle.setText(text);
      }

      return styles[feature.getGeometry().getType()];
    }
  });

  // BDORTHO layer
  var resolutions = [];
  var matrixIds = [];
  var proj3857 = olProjGet("EPSG:3857");
  var maxResolution = olExtentGetWidth(proj3857.getExtent()) / 256;

  for (var i = 0; i < 18; i++) {
    matrixIds[i] = i.toString(); // eslint-disable-line security/detect-object-injection
    resolutions[i] = maxResolution / Math.pow(2, i); // eslint-disable-line security/detect-object-injection
  }

  var tileGrid = new WMTSTileGrid({
    origin: [-20037508, 20037508],
    resolutions,
    matrixIds
  });

  var key = "7wbodpc2qweqkultejkb47zv";

  var ignSource = new WMTSSource({
    url: "https://wxs.ign.fr/" + key + "/wmts",
    //layer: "GEOGRAPHICALGRIDSYSTEMS.MAPS",
    layer: "ORTHOIMAGERY.ORTHOPHOTOS",
    matrixSet: "PM",
    format: "image/jpeg",
    projection: "EPSG:3857",
    tileGrid,
    style: "normal"/*, TODO: update this to openlayers 5
    attributions: [new ol.Attribution({
      html: "<a href=\"http://www.geoportail.fr/\" target=\"_blank\">" +
        "<img src=\"https://api.ign.fr/geoportail/api/js/latest/" +
        "theme/geoportal/img/logo_gp.gif\"></a>"
    })]*/
  });

  var bdorthoLayer = new TileLayer({
    name: "bdorthoLayer",
    source: ignSource
  });

  let map = new ExtendedMap ({ // Openlayers Map
      layers: [bdorthoLayer, hivesLayer, vegetationsLayer],
      target: "ancgis-map",
      keyboardEventTarget: document,
      controls: [
        new PeriodSwitcher(),
        new Attribution(),
        new ZoomSlider(),
        new ScaleLine(),
        new MousePosition({
          className:"",
          target:document.getElementById("ancgis-mapstatus-mouseposition"),
          coordinateFormat(coords) {
            var template = "X: {x} - Y: {y} ";
            return coordinateFormat(coords, template);
        }})
      ],
      view: new View({
        zoom: 20,
        //center: ol.proj.transform([5, 45], "EPSG:4326", "EPSG:3857")
        center: [308555, 6121070] // Chez Didier
      })
    });

    // Set the default values and save the new zone
    vegetationsLayerSource.on(VectorEventType.ADDFEATURE, function(e){
      e.feature.setProperties({
        layerName: vegetationsLayerName,
        dao: zoneDAO,
        form: zoneForm
      }, true);
      if ( typeof e.feature.getId() === "undefined" ) {
        zoneDAO.createFeature(e.feature); // Note: Raise the dispatching of the CHANGEFEATURE event
      } else {
        // Initialize the histogram
        map.dispatchPeriodPotentialChangeEvent();
      }
      // Note: The PeriodPotentialChangeEvent is also dispatched after the zone form validation.
    });
    vegetationsLayerSource.on(VectorEventType.REMOVEFEATURE, function(e){
      map.dispatchPeriodPotentialChangeEvent();
    });
    vegetationsLayerSource.on(VectorEventType.CHANGEFEATURE, function(e){
      map.dispatchPeriodPotentialChangeEvent();
    });
    // Add the features from the local database
    vegetationsLayerSource.addFeatures(await featuresToGeoJson("vegetation-zones"));

    return map;
};
