var overviewMap;
var zoomedMap;
var selectedData;
var selectedCountry;
var selectedCountryCoordinates;
//selectedUniversity = object with all info about the selected university
var selectedUniversity;
var svg;
var yearSelected;
//view = 'world', 'country' or 'university'
var view = 'world';

d3.csv("Datasets/Erasmus Data/Dataset Bert Willems/UIT Totaal (Filtered).csv", function(error, csv_data) {
  csv_data.forEach(function(student) {
    student.Begin = parseInt(student.Begin);
    student.Eind = parseInt(student.Eind);
  });

  selectedData = csv_data;

  yearSelected = [2012, 2019];
  var dataset = makeDataset(csv_data,yearSelected);
  updateText(yearSelected[0],yearSelected[1],countStudentsTotal(dataset));

  initializeView(dataset);

  slider.noUiSlider.on('update',function(values,handle){
    yearSelected[handle] = parseInt(values[handle]);
    var dataset = makeDataset(csv_data,yearSelected);
    selectedData = updateSelectedData(csv_data,yearSelected[0],yearSelected[1]);
    overviewMap.updateChoropleth(dataset);
    if(view=='country' || view=='university'){
      zoomToCountry(selectedCountry,selectedCountryCoordinates,dataset);
      //graphs en text worden geupdate in de zoomToCountry function
    }else{
      updateStudentCountGraph(yearSelected[0],yearSelected[1]);
      updateText(yearSelected[0],yearSelected[1],countStudentsTotal(dataset));
      //TODO
      updateFacultyGraph();
    }
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
  initializeStudentCountGraph(2012,2019);
  //TODO
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
        document.getElementById('universityName').innerHTML = "";
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
    height: 550,
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

function initializeStudentCountGraph(begin, end){
  var margin = {top: 50, right: 50, bottom: 50, left: 50}
    , width = (window.innerWidth - margin.left - margin.right)/3
    , height = (window.innerHeight - margin.top - margin.bottom)/2;

  //number of datapoints
  var n = end-begin;
  var yearlyCount = getStudentCountPerYearTotal();

  // Set the ranges
  var x = d3v5.scaleLinear().range([0, width]);
  var y = d3v5.scaleLinear().range([height, 0]);

  // Define the axes
  var xAxis = d3v5.axisBottom(x).ticks(n);
  var yAxis = d3v5.axisLeft(y);

  // Define the line
  var valueline = d3v5.line()
      .x(function(d) { return x(d.key); })
      .y(function(d) { return y(d.values); })
      .curve(d3v5.curveMonotoneX);

  svg = d3v5.select("body").append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
    .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  // Scale the range of the data
  x.domain(d3v5.extent(yearlyCount, function(d) { return d.key; }));
  y.domain([0, d3v5.max(yearlyCount, function(d) { return d.values; })]);

  // Add the valueline path
  svg.append("path")
      .attr("class", "line")
      .attr("d", valueline(yearlyCount));

  // Add the X Axis
  svg.append("g")
      .attr("class", "x axis")
      .attr("transform", "translate(0," + height + ")")
      .call(xAxis);

  // Add the Y Axis
  svg.append("g")
      .attr("class", "y axis")
      .call(yAxis);

  updateNodes(yearlyCount,x,y);
}

function updateStudentCountGraph(begin, end) {
  var margin = {top: 50, right: 50, bottom: 50, left: 50}
    , width = (window.innerWidth - margin.left - margin.right)/3
    , height = (window.innerHeight - margin.top - margin.bottom)/2;

  //number of datapoints
  var n = end-begin;
  var yearlyCount;
  switch(view){
    case 'world':
      yearlyCount = getStudentCountPerYearTotal();
      break;
    case 'country':
      yearlyCount = getStudentCountPerYearCountry(selectedCountry);
      break;
    case 'university':
      yearlyCount = getStudentCountPerYearUniversity(selectedUniversity.name);
      break;
    default:
      yearlyCount = getStudentCountPerYearTotal();
  }

  // Set the ranges
  var x = d3v5.scaleLinear().range([0, width]);
  var y = d3v5.scaleLinear().range([height, 0]);

  // Define the axes
  var xAxis = d3v5.axisBottom(x).ticks(n);
  var yAxis = d3v5.axisLeft(y);

  // Define the line
  var valueline = d3v5.line()
      .x(function(d) { return x(d.key); })
      .y(function(d) { return y(d.values); })
      .curve(d3v5.curveMonotoneX);

  // Scale the range of the data
  x.domain(d3v5.extent(yearlyCount, function(d) { return d.key; }));
  y.domain([0, d3v5.max(yearlyCount, function(d) { return d.values; })]);

  svg.select(".line") 
      //.duration(750)
      .attr("d", valueline(yearlyCount));
  svg.select(".y.axis")
      //.duration(750)
      .call(yAxis);
  svg.select(".x.axis")
      //.duration(750)
      .call(xAxis);
      
  updateNodes(yearlyCount,x,y);
}

function updateNodes(data,x,y) {
  var t = d3.transition()
      .duration(750);

  // JOIN new data with old elements.
  var nodes = svg.selectAll(".dot")
    .data(data);

  // EXIT old elements not present in new data.
  nodes.exit()
      .attr("class", "dot")
    .transition(t)
      .remove();

  // UPDATE old elements present in new data.
  nodes.attr("class", "dot")
    .transition(t)
      .attr("cx", function(d) { return x(d.key) })
      .attr("cy", function(d) { return y(d.values) })

  // ENTER new elements present in new data.
  nodes.enter().append("circle") 
      .attr("class", "dot")
      .attr("cx", function(d) { return x(d.key) })
      .attr("cy", function(d) { return y(d.values) })
      .attr("r", 5)
    .transition(t)
}

function initializeFacultyGraph(){
  //TODO
}

function updateFacultyGraph(){
  //TODO
}

function zoomToCountry(country, coordinates, dataset) {
  updateStudentCountGraph(yearSelected[0],yearSelected[1]);
  if(view=='country'){
    updateText(yearSelected[0],yearSelected[1], countStudentsCountry(dataset, country));
  };

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
    });

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
        numberOfStudents: datasetZoom[countryStudentCount[i].key].numberOfStudents
      });
    };

    if(view=='university'){
      selectedUniversity = bubbles.find(obj => {
        return obj.name === selectedUniversity.name;
      });
      updateText(yearSelected[0],yearSelected[1], selectedUniversity.numberOfStudents);
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

    d3.selectAll(".datamaps-bubble").on('click', function(bubble) {
      view = 'university';
      selectedUniversity = bubble;
      updateStudentCountGraph(yearSelected[0],yearSelected[1]);
      updateText(yearSelected[0],yearSelected[1],bubble.numberOfStudents);
      document.getElementById('universityName').innerHTML = bubble.name;
    });
  });
};


///HELP FUNCTIONS///
function countStudentsTotal(dataset){
  var count = 0;
  Object.keys(dataset).forEach(function(country) {
    count += dataset[country].numberOfStudents;
  })
  return count;
}

function countStudentsCountry(dataset, country){
  var countries = Datamap.prototype.worldTopo.objects.world.geometries;
  var iso = "";
  countries.forEach(function(item) {
    if (country==item.properties.name) {
      iso = item.properties.iso;
    }
  });
  count = dataset[iso].numberOfStudents;
  return count;
}


function getStudentCountPerYearTotal(){
  var yearlyCount = d3.nest()
    .key(function(d) {
      return d.Begin;
    })
    .rollup(function(leaves) {
      return leaves.length;
    })
    .entries(selectedData);
  return yearlyCount;
}

function getStudentCountPerYearCountry(country){
  var yearlyCount = d3.nest()
    .key(function(d) {
      return d.Land;
    })
    .key(function(d) {
      return d.Begin;
    })
    .rollup(function(leaves) {
      return leaves.length;
    })
    .entries(selectedData);
  var yearlyCountPerCountry = yearlyCount.find(obj => {
    return obj.key === country;
  }).values;
  return yearlyCountPerCountry;
}

function getStudentCountPerYearUniversity(university){
  var studentCount = d3.nest()
    .key(function(d) {
      return d.Uitwisselingsinstelling;
    })
    .key(function(d) {
      return d.Begin;
    })
    .rollup(function(leaves) {
      return leaves.length;
    })
    .entries(selectedData);
  var yearlyCountPerUniversity = studentCount.find(obj => {
    return obj.key === university;
  }).values;
  return yearlyCountPerUniversity;
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