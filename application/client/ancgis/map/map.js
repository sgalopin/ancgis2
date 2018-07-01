/*global ol*/
require("../../ol/interaction/addhive");
require("../../ol/interaction/editproperties");
require("../../ol/interaction/removefeatures");
require("../../ol/interaction/modifyfeature");
require("../../ol/control/periodswitchereventtype");
require("../../ol/control/periodswitcherevent");
require("../../ol/control/periodswitcher");

/**
 * Map builder.
 */
module.exports = (function() {

  var zoneDAO = require("../dao/zone");
  var hiveDAO = require("../dao/hive");
  var zoneForm = require("../form/zone");
  var hiveForm = require("../form/hive");

  // Hives layer
  var hivesLayerSource = new ol.source.Vector({
    wrapX: false,
    url: "./rest/hives",
      format: new ol.format.GeoJSON()
  });
  var hivesLayerName = "hivesLayer";
  // Set the default values and save the new hive
  hivesLayerSource.on(ol.source.VectorEventType.ADDFEATURE, function(e){
    e.feature.setProperties({
      layerName: hivesLayerName,
      dao: hiveDAO,
      form: hiveForm
    }, true);
    if ( typeof e.feature.getId() === "undefined" ) {
      hiveDAO.createFeature(e.feature);
    }
  });
  var hivesLayer = new ol.layer.Vector({
    name: hivesLayerName,
    source: hivesLayerSource,
    style(feature) {
      var ppts = feature.getProperties();
      return new ol.style.Style({
        fill: new ol.style.Fill({
          color: "red"
        }),
        stroke: new ol.style.Stroke({
          color: "black",
          width: 2
        }),
        text: new ol.style.Text({
          text: "N°" + ppts.registrationNumber
        })
      });
    }
  });

  // Draw layer
  // Add the circle type to the GeoJSON (not supported yet)
  ol.format.GeoJSON.GEOMETRY_READERS_["Circle"] = function(object) {
    return new ol.geom.Circle(object.coordinates, object.radius);
  };
  ol.format.GeoJSON.GEOMETRY_WRITERS_["Circle"] = function(geometry, optOptions) {
    return ({
      type: "Circle",
      coordinates: geometry.getCenter(),
      radius: geometry.getRadius()
    });
  };
  var vegetationsLayerSource = new ol.source.Vector({
    wrapX: false,
    url: "./rest/vegetation-zones",
      format: new ol.format.GeoJSON()
  });
  var vegetationsLayerName = "vegetationsLayer";
  // Set the default values and save the new zone
  vegetationsLayerSource.on(ol.source.VectorEventType.ADDFEATURE, function(e){
    e.feature.setProperties({
      layerName: vegetationsLayerName,
      dao: zoneDAO,
      form: zoneForm
    }, true);
    if ( typeof e.feature.getId() === "undefined" ) {
      zoneDAO.createFeature(e.feature); // Note: Raise the dispatching of the CHANGEFEATURE event
    } else {
      // Initialize the histogram
      require("./map").dispatchPeriodPotentialChangeEvent();
    }
    // Note: The PeriodPotentialChangeEvent is also dispatched after the zone form validation.
  });
  vegetationsLayerSource.on(ol.source.VectorEventType.REMOVEFEATURE, function(e){
    require("./map").dispatchPeriodPotentialChangeEvent();
  });
  vegetationsLayerSource.on(ol.source.VectorEventType.CHANGEFEATURE, function(e){
    require("./map").dispatchPeriodPotentialChangeEvent();
  });
  var vegetationsLayer = new ol.layer.Vector({
    name: vegetationsLayerName,
    source: vegetationsLayerSource,
    style(feature) {
      var ppts = feature.getProperties();

      // Style stroke and fill
      var styles = {
        "Polygon": new ol.style.Style({
          stroke: new ol.style.Stroke({
            color: "black",
            width: 2
          }),
          fill: new ol.style.Fill({
            color: "rgba(255, 255, 0, 0.1)"
          })
        }),
        "Circle": new ol.style.Style({
          stroke: new ol.style.Stroke({
            color: "black",
            //lineDash: [4],
            width: 2
          }),
          fill: new ol.style.Fill({
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
        text = new ol.style.Text({ text });
        styles.Polygon.setText(text);
        styles.Circle.setText(text);
      }

      return styles[feature.getGeometry().getType()];
    }
  });

  // BDORTHO layer
  var resolutions = [];
  var matrixIds = [];
  var proj3857 = ol.proj.get("EPSG:3857");
  var maxResolution = ol.extent.getWidth(proj3857.getExtent()) / 256;

  for (var i = 0; i < 18; i++) {
    matrixIds[i] = i.toString(); // eslint-disable-line security/detect-object-injection
    resolutions[i] = maxResolution / Math.pow(2, i); // eslint-disable-line security/detect-object-injection
  }

  var tileGrid = new ol.tilegrid.WMTS({
    origin: [-20037508, 20037508],
    resolutions,
    matrixIds
  });

  var key = "7wbodpc2qweqkultejkb47zv";

  var ignSource = new ol.source.WMTS({
    url: "http://wxs.ign.fr/" + key + "/wmts",
    //layer: "GEOGRAPHICALGRIDSYSTEMS.MAPS",
    layer: "ORTHOIMAGERY.ORTHOPHOTOS",
    matrixSet: "PM",
    format: "image/jpeg",
    projection: "EPSG:3857",
    tileGrid,
    style: "normal",
    attributions: [new ol.Attribution({
      html: "<a href=\"http://www.geoportail.fr/\" target=\"_blank\">" +
        "<img src=\"https://api.ign.fr/geoportail/api/js/latest/" +
        "theme/geoportal/img/logo_gp.gif\"></a>"
    })]
  });

  var bdorthoLayer = new ol.layer.Tile({
    name: "bdorthoLayer",
    source: ignSource
  });

  ol.Map.prototype.getLayerByName = function(layerName) {
    return this.getLayers().getArray().find(function(layer) {
      return layer.get("name") === layerName;
    });
  };

  ol.Map.prototype.dispatchPeriodPotentialChangeEvent = function() {
    this.dispatchEvent(new ol.control.PeriodSwitcherEvent (
      ol.control.PeriodSwitcherEventType.PERIODPOTENTIALCHANGE,
      this
    ));
  };


  return new ol.Map ({ // Openlayers Map
      layers: [bdorthoLayer, hivesLayer, vegetationsLayer],
      target: "ancgis-map",
      keyboardEventTarget: document,
      controls: [
        new ol.control.PeriodSwitcher(),
        new ol.control.Attribution(),
        new ol.control.ZoomSlider(),
        new ol.control.ScaleLine(),
        new ol.control.MousePosition({
          className:"",
          target:document.getElementById("ancgis-mapstatus-mouseposition"),
          coordinateFormat(coords) {
            var template = "X: {x} - Y: {y} ";
            return ol.coordinate.format(coords, template);
        }})
      ],
      view: new ol.View({
        zoom: 20,
        //center: ol.proj.transform([5, 45], "EPSG:4326", "EPSG:3857")
        center: [308555, 6121070] // Chez Didier
      })
    });
}());
