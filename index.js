var overviewMap;
var zoomedMap;
var selectedData;
var selectedCountry;
var selectedCountryCoordinates;
//view = 'world', 'country' or 'university'
var view = 'world';

d3.csv("Datasets/Erasmus Data/Dataset Bert Willems/UIT Totaal (Filtered).csv", function(error, csv_data) {
  csv_data.forEach(function(student) {
    student.Begin = parseInt(student.Begin);
    student.Eind = parseInt(student.Eind);
  });

  selectedData = csv_data;

  var yearSelected = [2012, 2019];
  var dataset = makeDataset(csv_data,yearSelected);
  updateText(yearSelected[0],yearSelected[1],countStudents(dataset));

  initializeView(dataset);

  slider.noUiSlider.on('update',function(values,handle){
    yearSelected[handle] = parseInt(values[handle]);
    var dataset = makeDataset(csv_data,yearSelected);
    selectedData = updateSelectedData(csv_data,yearSelected[0],yearSelected[1]);
    overviewMap.updateChoropleth(dataset);
    if(view=='country' || view=='university'){
      zoomToCountry(selectedCountry,selectedCountryCoordinates,dataset);
    }
    updateText(yearSelected[0],yearSelected[1],countStudents(dataset));
  })
});

function updateSelectedData(csv_data,begin, end){
  //TODO faculteiten selectie toevoegen
  selectedYears = [];
  for(year = begin; year < end; year++){
    selectedYears.push(year);
  };
  var selectedData = csv_data.filter(function(d){
    if( selectedYears.includes(d["Begin"])){ 
      return d;
    } 
  })
  return selectedData;
}

function makeDataset(data, selected) {
  var cf = crossfilter(data);
  var studentCountByStart = cf.dimension(student => student.Begin);
  var studentCountByEnd = cf.dimension(student => student.Eind);
  var studentCountPerCountry = {};

  studentCountByStart.filter([selected[0], Infinity]);
  studentCountByEnd.filter([-Infinity, selected[1] + 1]);

  studentCountPerCountry = d3.nest()
    .key(function(d) {
      return d.Land;
    })
    .rollup(function(leaves) {
      return leaves.length;
    })
    .map(studentCountByEnd.top(Infinity));

  // Build color scale
  var studentValues = Object.keys(studentCountPerCountry).map(function(key) {
    return studentCountPerCountry[key]
  });
  var paletteScale = buildPaletteScale(studentValues);

  var dataset = {};
  var countries = Datamap.prototype.worldTopo.objects.world.geometries;

  countries.forEach(function(country) {
    if (Object.keys(studentCountPerCountry).includes(country.properties.name)) {
      var iso = country.properties.iso;
      var value = studentCountPerCountry[country.properties.name];
      dataset[iso] = {
        color: paletteScale(value),
        numberOfStudents: value
      };
    }
  });
  if (dataset.BEL !== undefined)
    dataset.BEL.color = '#3FB8AF';//'rgba(0,244,244,0.9)';

  return dataset;
}

function initializeView(dataset){
  initializeMaps(dataset);
  initializeStudentCountGraph();
  initializeFacultyGraph();
}

function initializeMaps(dataset){
  //map config
  overviewMap = new Datamap({
    element: document.getElementById('container1'),
    //set projection to Europe
    setProjection: function(element, options) {
      var projection = d3.geo.mercator()
        .center([10, 52])
        .scale(700)
        .translate([element.offsetWidth / 2, element.offsetHeight / 2]);
      var path = d3.geo.path()
        .projection(projection);
      return {
        path: path,
        projection: projection
      };
    },
    done: function(datamap) {
      datamap.svg.selectAll('.datamaps-subunit').on('click', function(geography) {
        document.getElementById('countryName').innerHTML = geography.properties.name;
        d3.json("Datasets/countries.json", function(data) {
          var countryData = data.find(obj => {
            return obj.name === geography.properties.name
          })
          selectedCountry = geography.properties.name;
          selectedCountryCoordinates = countryData.latlng;
          view = 'country';
          zoomToCountry(selectedCountry, selectedCountryCoordinates, dataset);
        });
      });
    },
    height: 600,
    fills: {defaultFill: '#F5F5F5'},
    data: dataset,
    geographyConfig: {
      borderColor: '#DEDEDE',
      highlightBorderWidth: 3,
      // don't change color on mouse hover
      highlightFillColor: function(geo) {
        return geo.color || '#F5F5F5';
      },
      // only change border
      highlightBorderColor: '#B7B7B7',
      // show desired information in tooltip
      popupTemplate: function(geo, data) {
        // don't show tooltip if country don't present in dataset
        if (!data) {
          return;
        }
        // tooltip content
        return ['<div class="hoverinfo">',
          '<strong>', geo.properties.name, '</strong>',
          '<br># Students: <strong>', data.numberOfStudents, '</strong>',
          '</div>'
        ].join('');
      }
    }
  });
}

function initializeStudentCountGraph(){
  var margin = {top: 50, right: 50, bottom: 50, left: 50}
    , width = (window.innerWidth - margin.left - margin.right)/3
    , height = (window.innerHeight - margin.top - margin.bottom)/2;

  //number of datapoints
  var n = 7;
  //var years = ['2012-2013', '2013-2014', '2014-2015', '2015-2016', '2016-2017', '2017-2018', '2018-2019'];
  var years = [2012, 2013, 2014, 2015, 2016, 2017, 2018];
  var yearlyCount = d3.nest()
    .key(function(d) {
      return d.Begin;
    })
    .rollup(function(leaves) {
      return leaves.length;
    })
    .entries(selectedData);
  var data = [];
  for(i=0;i<n;i++){
    data.push({y:yearlyCount[i].values})
  };
  var maxCount = Math.max.apply(Math, data.map(function(o) { return o.y; }));

  var xScale = d3v5.scaleLinear()
      .domain([0, n-1]) 
      .range([0, width]); 

  var yScale = d3v5.scaleLinear()
      .domain([0, maxCount])  
      .range([height, 0]);  

  var line = d3v5.line()
      .x(function(d, i) { return xScale(i); }) 
      .y(function(d) { return yScale(d.y); }) 
      .curve(d3v5.curveMonotoneX) 

  var svg = d3v5.select("body").append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
    .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
  
  svg.append("g")
      .attr("class", "x axis")
      .attr("transform", "translate(0," + height + ")")
      .call(d3v5.axisBottom(xScale).ticks(n).tickValues([0,1,2,3,4,5,6])
      .tickFormat(function(n) { 
        var i = n+2
        var j = n+3
        return "201"+ i + "-201" + j
      })); 

  svg.append("g")
      .attr("class", "y axis")
      .call(d3v5.axisLeft(yScale)); 

  svg.append("path")
      .datum(data)
      .attr("class", "line")
      .attr("d", line);

  svg.selectAll(".dot")
      .data(data)
    .enter().append("circle") 
      .attr("class", "dot")
      .attr("cx", function(d, i) { return xScale(i) })
      .attr("cy", function(d) { return yScale(d.y) })
      .attr("r", 5)
}

function initializeFacultyGraph(){

}

function zoomToCountry(country, coordinates, dataset) {
  var studentCount = d3.nest()
    .key(function(d) {
      return d.Land;
    })
    .key(function(d) {
      return d.Uitwisselingsinstelling;
    })
    .rollup(function(leaves) {
      return leaves.length;
    })
    .entries(selectedData);
  var countryStudentCount = studentCount.find(obj => {
    return obj.key === country;
  }).values;

  // Build color scale
  var studentPerUniValues = Object.keys(countryStudentCount).map(function(key) {
    return countryStudentCount[key].values
  });
  var paletteScale = buildPaletteScale(studentPerUniValues);

  datasetZoom = {};
  fillsZoom = {
    defaultFill: '#F5F5F5'
  };

  for (i = 0; i < countryStudentCount.length; i++) {
    var university = countryStudentCount[i].key;
    var amountOfStudents = countryStudentCount[i].values;
    fillsZoom[university] = paletteScale(amountOfStudents);
    datasetZoom[university] = {
      fillKey: university,
      numberOfStudents: amountOfStudents
    };
  };

  //country color with lower opacity
  var countryColor = '#DEDEDE';
  var countries = Datamap.prototype.worldTopo.objects.world.geometries;
  countries.forEach(function(datamapsCountry) {
    if (country==datamapsCountry.properties.name) {
      var iso = datamapsCountry.properties.iso;
      countryColor = dataset[iso].color;
      colorLowerOpacity = countryColor.slice(0,countryColor.length-1)+ ', 0.2)'
      fillsZoom[iso] = colorLowerOpacity;
      datasetZoom[iso] = {fillKey: iso, borderColor:colorLowerOpacity};
    }
  });

  $("#container2").empty();
  zoomedMap = new Datamap({
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
      return {
        path: path,
        projection: projection
      };
    },
    height: 300,
    fills: fillsZoom,
    data: datasetZoom,
    geographyConfig: {
      borderColor: '#DEDEDE',
      highlightBorderWidth: 3,
      // don't change color on mouse hover
      highlightFillColor: function(geo) {
        return fillsZoom[geo.fillKey] || '#F5F5F5';
      },
      // only change border
      highlightBorderColor: false,//'#B7B7B7',
      // show desired information in tooltip
      popupTemplate: function(geo, data) {
        return;
      }
    }
  });

  bubbles = [];

  d3.json("Datasets/countries.json", function(data) {
    var countryData = data.find(obj => {
      return obj.name === country;
    })
    for (i = 0; i < countryStudentCount.length; i++) {
      //TODO: echte coordinaten gebruiken
      var coordinates = getRandomCoordinates(countryData.latlng[0], countryData.latlng[1], 2);
      //bubbles.push({name: countryStudentCount[i].key, latitude: coordinates[0], longitude: coordinates[1], radius: countryStudentCount[i].values, fillKey: 'BEL'});
      bubbles.push({
        name: countryStudentCount[i].key,
        latitude: coordinates[0],
        longitude: coordinates[1],
        radius: 10,
        fillKey: countryStudentCount[i].key,
        //color: paletteScale(countryStudentCount[i].values)
      });
    }
    zoomedMap.bubbles(bubbles, {
      popupTemplate: function(geo, data) {
        return ['<div class="hoverinfo">',
          '<strong>', data.name, '</strong>',
          '<br># Students: <strong>', datasetZoom[data.name].numberOfStudents, '</strong>',
          '</div>'
        ].join('');
      }
    });
  })
};


///HELP FUNCTIONS///
function countStudents(dataset){
  var count = 0;
  Object.keys(dataset).forEach(function(country) {
    count += dataset[country].numberOfStudents;
  })
  return count;
}

function updateText(begin, end, totalCount){
  document.getElementById('begin').innerHTML = begin;
  document.getElementById('end').innerHTML = end;
  document.getElementById('totalCount').innerHTML = totalCount;
  document.getElementById('yearlyCount').innerHTML = Math.floor(totalCount/(end-begin));
}

function buildPaletteScale(values){
  var minValue = Math.min.apply(null, values);
  var maxValue = Math.max.apply(null, values);
  var paletteScale = d3v5.scaleSequential()
    .interpolator(d3v5.interpolateOrRd)
    .domain([minValue, maxValue]);
  return paletteScale;
}

function getRandomInteger(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomCoordinates(xCenter, yCenter, maxRadius) {
  var angle = Math.random() * Math.PI * 2;
  var radius = getRandomInteger(0, maxRadius);
  var x = xCenter + Math.cos(angle) * radius;
  var y = yCenter + Math.sin(angle) * radius;
  return [x, y];
}