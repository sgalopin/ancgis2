
// Define a namespace for the application.
var anc = {
	interaction:{}
};

// Hives layer
var stroke = new ol.style.Stroke({color: 'black', width: 2});
var fill = new ol.style.Fill({color: 'red'});
var hivesLayerSource = new ol.source.Vector({wrapX: false});
var hivesLayer = new ol.layer.Vector({
	source: hivesLayerSource,
	style: new ol.style.Style({
		fill: fill,
		stroke: stroke,
		text: new ol.style.Text({
			text: 'N°...'
		})
	})
});

// Draw layer
// Add the circle type to the GeoJSON (not supported yet)
ol.format.GeoJSON.GEOMETRY_READERS_['Circle'] = function(object) {
  return new ol.geom.Circle(object.coordinates, object.radius);
};
var drawLayerSource = new ol.source.Vector({
	wrapX: false,
	url: './ressources/geojson/features.geojson',
    format: new ol.format.GeoJSON()
});
var drawLayer = new ol.layer.Vector({
	name: 'draw',
	source: drawLayerSource,
	style: function(feature) {
		var ppts = feature.getProperties();
		// Style text
		if(ppts.flore) {
			var text = '';
			ppts.flore.forEach(function(taxon, i) {
				if (i !== 0) {
					text += '\n\n';
				}
			    text += taxon.taxon
				+ '\n' 
				+ taxon.period
				+ '\n' 
				+ taxon.recovery
				+ '%';
			});
			text = new ol.style.Text({
				text: text
			});
		}
		// Style stroke and fill
		var styles = {
		    'Polygon': new ol.style.Style({
		      stroke: new ol.style.Stroke({
		        color: 'black',
		        width: 2
		      }),
		      fill: new ol.style.Fill({
		        color: 'rgba(255, 255, 0, 0.1)'
		      }),
			  text: text ? text : undefined
		    }),
		    'Circle': new ol.style.Style({
		      stroke: new ol.style.Stroke({
		        color: 'black',
		        //lineDash: [4],
		        width: 2
		      }),
		      fill: new ol.style.Fill({
		        color: 'rgba(0,255,0,0.1)'
		      }),
			  text: text ? text : undefined
		    })
		};
		return styles[feature.getGeometry().getType()];
	}
});

// BDORTHO layer
var resolutions = [];
var matrixIds = [];
var proj3857 = ol.proj.get('EPSG:3857');
var maxResolution = ol.extent.getWidth(proj3857.getExtent()) / 256;

for (var i = 0; i < 18; i++) {
	matrixIds[i] = i.toString();
	resolutions[i] = maxResolution / Math.pow(2, i);
}

var tileGrid = new ol.tilegrid.WMTS({
	origin: [-20037508, 20037508],
	resolutions: resolutions,
	matrixIds: matrixIds
});

var key = '7wbodpc2qweqkultejkb47zv';

var ign_source = new ol.source.WMTS({
	url: 'http://wxs.ign.fr/' + key + '/wmts',
	//layer: 'GEOGRAPHICALGRIDSYSTEMS.MAPS',
	layer: 'ORTHOIMAGERY.ORTHOPHOTOS',
	matrixSet: 'PM',
	format: 'image/jpeg',
	projection: 'EPSG:3857',
	tileGrid: tileGrid,
	style: 'normal',
	attributions: [new ol.Attribution({
	  html: '<a href="http://www.geoportail.fr/" target="_blank">' +
		  '<img src="https://api.ign.fr/geoportail/api/js/latest/' +
		  'theme/geoportal/img/logo_gp.gif"></a>'
	})]
});

var bdortho = new ol.layer.Tile({
	source: ign_source
});

// Map
anc.map = new ol.Map({
	layers: [bdortho, hivesLayer, drawLayer],
	target: 'anc-map',
	keyboardEventTarget: document,
	controls: [
		new ol.control.PeriodSwitcher(),
		new ol.control.Attribution(),
		new ol.control.ZoomSlider(),
		new ol.control.ScaleLine(),
		new ol.control.MousePosition({
			className:'',
			target:document.getElementById('anc-mapstatus-mouseposition'),
			coordinateFormat :function(coords){
				var template = 'X: {x} - Y: {y} ';
				return ol.coordinate.format(coords, template);
		}})
	],
	view: new ol.View({
	  zoom: 20,
	  //center: ol.proj.transform([5, 45], 'EPSG:4326', 'EPSG:3857')
	  center: [308555, 6121070] // Chez Didier
	})
 });

// Add Hive Button Control
anc.interaction.addhive = new ol.interaction.AddHive({
	source: hivesLayerSource
});
// Draw Polygon Button Control
anc.interaction.drawpolygon = new ol.interaction.Draw({
	source: drawLayerSource,
	type: 'Polygon'
});
// Draw Circle Button Control
anc.interaction.drawcircle = new ol.interaction.Draw({
	source: drawLayerSource,
	type: 'Circle'
});
// Edit Zone Properties interaction
anc.interaction.editzoneproperties = new ol.interaction.EditZoneProperties({
	propertiesFormId: 'anc-zoneform',
	zonesLayerName: 'draw'
});

$('#anc-mapcontrol-tbar>button').click(function(){
	event.stopPropagation();
	$(this).toggleClass('active');
	if($(this).is('.active')){
		$('#anc-mapcontrol-tbar>button[id!="'+ $(this).attr('id') +'"]').trigger('controlChange');
		anc.map.addInteraction(anc.interaction[$(this)[0].dataset.shortid]);
		$('#anc-map').trigger('interactionAdded');
	} else {
		anc.map.removeInteraction(anc.interaction[$(this)[0].dataset.shortid]);
	}
});
$('#anc-mapcontrol-tbar>button').on('controlChange', function(event) {
	event.stopPropagation();
	if($(this).is('.active')){
		$(this).toggleClass('active');
		anc.map.removeInteraction(anc.interaction[$(this)[0].dataset.shortid]);
	}
});
$('#anc-zoneform-cancelbtn').on('click', function(event) {
	event.stopPropagation();
	$('#anc-zoneform').toggleClass('hidden');
});
// Keep the editzoneproperties on the top of the map's interactions
window.addEventListener("contextmenu", function(e) { e.preventDefault(); })
anc.map.addInteraction(anc.interaction.editzoneproperties);
$('#anc-map').on('interactionAdded', function(event) {
	event.stopPropagation();
	anc.map.removeInteraction(anc.interaction.editzoneproperties);
	anc.map.addInteraction(anc.interaction.editzoneproperties);
});