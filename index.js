//map config
var map = new Datamap({
  scope: 'world',
  element: document.getElementById('container1'),
  //set projection to Europe
  setProjection: function(element, options) { 
    var projection = d3.geo.mercator()
      .center([10, 52])
      .scale(700)
      .translate([element.offsetWidth / 2, element.offsetHeight / 2]);
    var path = d3.geo.path()
      .projection(projection);                 
   return {path: path, projection: projection};
  },
  height: 500,
  fills: {
    defaultFill: '#f0af0a',
    belgium: 'rgba(0,244,244,0.9)',
    selectedCountry: 'red',
  },
  data: {
    BEL: {fillKey: 'belgium' },     
  }
})

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