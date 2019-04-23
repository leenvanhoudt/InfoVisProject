
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
          zoomToCountry(geography.properties.name,countryData.latlng);
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

function zoomToCountry(country,coordinates){
  $("#container2").empty();
  var zoomed = new Datamap({
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
  bubbles = [];
  d3.csv("Datasets/testdata2010.csv", function(error, csv_data) {
    var studentCount = d3.nest()
      .key(function(d) { return d.land; })
      .key(function(d) { return d.universiteit; })
      .rollup(function(leaves) { return leaves.length;})
      .entries(csv_data);
    var countryStudentCount = studentCount.find(obj => {
      return obj.key === country;
    }).values;
    d3.json("Datasets/countries.json", function(data) {
      var countryData = data.find(obj => {
        return obj.name === country;
      })
      for(i=0;i<countryStudentCount.length;i++){
        var coordinates = getRandomCoordinates(countryData.latlng[0],countryData.latlng[1],2);
        bubbles.push({name: countryStudentCount[i].key, latitude: coordinates[0], longitude: coordinates[1], radius: countryStudentCount[i].values, fillKey: 'gt50'});
      }
      zoomed.bubbles(bubbles, {
      popupTemplate: function(geo, data) {
        return "<div class='hoverinfo'>" + data.name + "</div>";
      }
     });
    })
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

function getRandomInteger(min, max) {
  return Math.floor(Math.random() * (max - min + 1) ) + min;
}

function getRandomCoordinates(xCenter, yCenter, maxRadius){
  var angle = Math.random()*Math.PI*2;
  var radius = getRandomInteger(0,maxRadius);
  var x = xCenter + Math.cos(angle)*radius;
  var y = yCenter + Math.sin(angle)*radius;
  return [x,y];
}



