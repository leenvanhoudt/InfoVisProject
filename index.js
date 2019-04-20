
//map config
var overviewMap = new Datamap({
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
  done: function(datamap) {
    datamap.svg.selectAll('.datamaps-subunit').on('click', function(geography) {
        document.getElementById('countryName').innerHTML = geography.properties.name;
        d3.json("Datasets/countries.json", function(data) {
          var countryData = data.find(obj => {
            return obj.name === geography.properties.name
          })
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

// Build color scale
var myColor = d3.scaleSequential()
  .interpolator(d3.interpolateViridis)
  .domain([1,200]);

  overviewMap.updateChoropleth({
    NL: function(){
      d3.csv("Datasets/testdata2010.csv", function(error, csv_data) {
      var studentCountPerUniversityPerCountry = d3.nest()
        .key(function(d) { return d.land; })
        .key(function(d) { return d.universiteit; })
        .rollup(function(leaves) { return leaves.length;})
        .entries(csv_data);
      //  console.log(JSON.stringify(studentCountPerUniversityPerCountry));

      var studentCountPerCountry = d3.nest()
        .key(function(d) { return d.land; })
        .rollup(function(leaves) { return leaves.length;})
        .entries(csv_data);
        console.log(JSON.stringify(studentCountPerCountry));
        console.log(studentCountPerCountry[0].values);
      });
    return myColor(studentCountPerCountry[0].values)},
});
}

//zoomed map config
var zoomedMap = new Datamap({
  element: document.getElementById('container2'),
  //set projection to Europe
  setProjection: function(element, options) {
    var projection = d3.geo.mercator()
      .center([4.7, 50.87])
      .scale(1200)
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
  $("#container2").empty();
  new Datamap({
    //scope: 'world',
    element: document.getElementById('container2'),
    //set projection to Europe
    setProjection: function(element, options) {
      var projection = d3.geo.mercator()
        .center([coordinates[1], coordinates[0]])
        .scale(1200)
        .translate([element.offsetWidth / 2, element.offsetHeight / 2]);
      var path = d3.geo.path()
        .projection(projection);
     return {path: path, projection: projection};
    },
    height: 300,
    fills: {
      defaultFill: '#f0af0a',
      belgium: 'rgba(0,244,244,0.9)',
    },
    data: {
      BEL: {fillKey: 'belgium' },
    }
  });
}

//arcs
overviewMap.arc([
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
overviewMap.bubbles([
 {name: 'Hot', latitude: 21.32, longitude: 5.32, radius: 10, fillKey: 'gt50'},
 {name: 'Chilly', latitude: -25.32, longitude: 120.32, radius: 18, fillKey: 'lt50'},
 {name: 'Hot again', latitude: 21.32, longitude: -84.32, radius: 8, fillKey: 'gt50'},

], {
 popupTemplate: function(geo, data) {
   return "<div class='hoverinfo'>It is " + data.name + "</div>";
 }
});
