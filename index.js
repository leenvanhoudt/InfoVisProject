//map config
var map = new Datamap({
  //scope: 'world',
  element: document.getElementById('container1'),
  //set projection to Europe
  setProjection: function(element, options) { 
    var projection = d3.geo.mercator()
      .center([20, 52])
      .scale(800)
      .translate([element.offsetWidth / 2, element.offsetHeight / 2]);
    var path = d3.geo.path()
      .projection(projection);                 
   return {path: path, projection: projection};
  },
  done: function(datamap) {
    datamap.svg.selectAll('.datamaps-subunit').on('click', function(geography) {
        document.getElementById('countryName').innerHTML = geography.properties.name;
        d3.json("Datasets/countries.json", function(data) {
          var countryData = data.find(obj => {
            return obj.name === geography.properties.name
          })
          //resetZoom(zoomedMap);
          zoomToCountry(zoomedMap,countryData.latlng);
        });
    });
  },
  height: 600,
  fills: {
    defaultFill: '#f0af0a',
    belgium: 'rgba(0,244,244,0.9)',
    selectedCountry: 'red',
  },
  data: {
    BEL: {fillKey: 'belgium' },
  }
});

//zoomed map config
var zoomedMap = new Datamap({
  //scope: 'world',
  element: document.getElementById('container2'),
  //set projection to Europe
  setProjection: function(element, options) { 
    var projection = d3.geo.mercator()
      .center([10, 52])
      .scale(800)
      .translate([element.offsetWidth / 2, element.offsetHeight / 2]);
    var path = d3.geo.path()
      .projection(projection);                 
   return {path: path, projection: projection};
  },
  height: 300,
  fills: {
    defaultFill: '#f0af0a',
    belgium: 'rgba(0,244,244,0.9)',
    selectedCountry: 'red',
  },
  data: {
    BEL: {fillKey: 'belgium' },     
  }
});

function zoomToCountry(map,coordinates){
  //TODO
  latitude = coordinates[0];
  longitude = coordinates[1];
  //map.projection.center([coordinates[0],coordinates[1]]);
  //map.svg.selectAll(".datamaps-subunits").transition().duration(750).attr("transform", "scale(1.5)translate("+coordinates[0]+","+coordinates[1]+")");
}

function resetZoom(map){
  map.svg.selectAll(".datamaps-subunits").transition().duration(750).attr("transform", d3.zoomIdentity);
}

//arcs
map.arc([
 {
  origin: {
      latitude: 50.87,
      longitude: 4.7
  },
  destination: {
      latitude: 48,
      longitude: 2
  }
},
{
  origin: {
    latitude: 50.87,
    longitude: 4.7
  },
  destination: {
    latitude: 59.9,
    longitude: 10.65
  }
}
], {strokeWidth: 2});

//bubbles, custom popup on hover template
map.bubbles([
 {name: 'Hot', latitude: 21.32, longitude: 5.32, radius: 10, fillKey: 'gt50'},
 {name: 'Chilly', latitude: -25.32, longitude: 120.32, radius: 18, fillKey: 'lt50'},
 {name: 'Hot again', latitude: 21.32, longitude: -84.32, radius: 8, fillKey: 'gt50'},

], {
 popupTemplate: function(geo, data) {
   return "<div class='hoverinfo'>It is " + data.name + "</div>";
 }
});