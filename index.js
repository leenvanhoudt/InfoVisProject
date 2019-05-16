var overviewMap;
var zoomedMap;
var selectedData;
var selectedCountry;
var selectedCountryCoordinates;
//selectedUniversity = object with all info about the selected university
var selectedUniversity;
var svg;
var svgBar;
var yearSelected;
//view = 'world', 'country' or 'university'
var view = 'world';
var sidebarVisible = false;
var allFacultiesSelected = true;

d3.csv("Datasets/Erasmus Data/Dataset Bert Willems/UIT Totaal (Filtered).csv", function(error, csv_data) {
  console.log(getFacultyColors());
  csv_data.forEach(function(student) {
    student.Begin = parseInt(student.Begin);
    student.Eind = parseInt(student.Eind);
  });

  selectedData = csv_data;
  yearSelected = [2012, 2019];

  var dataset = makeDataset(csv_data);
  updateText(yearSelected[0], yearSelected[1], countStudentsTotal(dataset));

  initializeView(dataset);

  d3.select(".allCheckbox").on("change", checkAll);
  d3.selectAll(".myCheckbox").on("change", checkSingle);
  slider.noUiSlider.on('update', function(values, handle) {
    yearSelected[handle] = parseInt(values[handle]);
    update();
  });

  function update() {
    selectedData = updateSelectedData(csv_data, yearSelected[0], yearSelected[1], getSelectedFaculties());
    var dataset = makeDataset(selectedData);
    if (Object.keys(dataset).length === 0) {
      dataset = makeDummySet(csv_data);
    }
    overviewMap.updateChoropleth(dataset);

    if (view == 'country' || view == 'university') {
      zoomToCountry(selectedCountry, selectedCountryCoordinates, dataset);
      //graphs en text worden geupdate in de zoomToCountry function
    } else {
      updateStudentCountGraph(yearSelected[0], yearSelected[1]);
      updateText(yearSelected[0], yearSelected[1], countStudentsTotal(dataset));
      //TODO
      updateFacultyGraph();
    }
  }

  function checkAll() {
    if (d3.select(".allCheckbox").property("checked")) {
      d3.selectAll(".myCheckbox").property("checked", true);
      allFacultiesSelected = true;
    } else {
      d3.selectAll(".myCheckbox").property("checked", false);
    }
    update();
  }

  function checkSingle() {
    if (d3.select(".allCheckbox").property("checked")) {
      d3.select(".allCheckbox").property("checked", false);
      allFacultiesSelected = false;
    } else if (d3.selectAll(".myCheckbox").property("checked")) {
      d3.select(".allCheckbox").property("checked", true);
      allFacultiesSelected = true;
    } else {
      allFacultiesSelected = false;
    }
    update();
  }
});

function updateSelectedData(csv_data, begin, end, faculties) {
  selectedYears = [];
  for (year = begin; year < end; year++) {
    selectedYears.push(year);
  };
  var selectedData = csv_data.filter(function(d) {
    if (selectedYears.includes(d["Begin"]) && faculties.includes(d["Faculteit"])) {
      return d;
    }
  })
  return selectedData;
}

function makeDataset(data) {
  var studentCountPerCountry = d3.nest()
    .key(function(d) {
      return d.Land;
    })
    .rollup(function(leaves) {
      return leaves.length;
    })
    .map(data);

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
    dataset.BEL.color = '#3FB8AF'; //'rgba(0,244,244,0.9)';

  return dataset;
}

function makeDummySet(data) {
  var studentCountPerCountry = d3.nest()
    .key(function(d) {
      return d.Land;
    })
    .map(data);

  var dataset = {};
  var countries = Datamap.prototype.worldTopo.objects.world.geometries;

  countries.forEach(function(country) {
    if (Object.keys(studentCountPerCountry).includes(country.properties.name)) {
      var iso = country.properties.iso;
      var value = studentCountPerCountry[country.properties.name];
      dataset[iso] = {
        color: '#F5F5F5',
        numberOfStudents: 0
      };
    }
  });
  if (dataset.BEL !== undefined)
    dataset.BEL.color = '#3FB8AF'; //'rgba(0,244,244,0.9)';

  return dataset;
}

function initializeView(dataset) {
  initializeMaps(dataset);
  initializeStudentCountGraph(2012, 2019);
  //TODO
  initializeFacultyGraph();
}

function initializeMaps(dataset) {
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
    fills: {
      defaultFill: '#F5F5F5'
    },
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

function initializeStudentCountGraph(begin, end) {
  var margin = {
      top: 50,
      right: 50,
      bottom: 50,
      left: 50
    },
    width = (window.innerWidth - margin.left - margin.right) / 3,
    height = (window.innerHeight - margin.top - margin.bottom) / 2;

  svg = d3v5.select(".linegraph").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  // Add the valueline path
  svg.append("path")
    .attr("class", "line")

  // Add the X Axis
  svg.append("g")
    .attr("class", "x axis")
    .attr("transform", "translate(0," + height + ")")

  // Add the Y Axis
  svg.append("g")
    .attr("class", "y axis")

  updateStudentCountGraph(begin,end);
}

function updateStudentCountGraph(begin, end) {
  var margin = {
      top: 50,
      right: 50,
      bottom: 50,
      left: 50
    },
    width = (window.innerWidth - margin.left - margin.right) / 3,
    height = (window.innerHeight - margin.top - margin.bottom) / 2;

  //number of datapoints
  var n = end - begin;

  var range;
  var lineData = [];
  if(allFacultiesSelected) {
    var yearlyCount = getYearlyCount(selectedData);
    range = yearlyCount;
    lineData.push({key:'Total',value:yearlyCount});
  } else {
    var faculties = getSelectedFaculties();
    var highestCount = 0;
    for(i=0;i<faculties.length;i++){
      var facultyData = updateSelectedData(selectedData,yearSelected[0],yearSelected[1],[faculties[i]]);
      var yearlyCount = getYearlyCount(facultyData);
      lineData.push({key:'Total',value:yearlyCount});
      if(getHighestCount(yearlyCount) > highestCount){
        range = yearlyCount;
        highestCount = getHighestCount(yearlyCount);
      }
    }
  }

  // Set the ranges
  var x = d3v5.scaleLinear().range([0, width]);
  var y = d3v5.scaleLinear().range([height, 0]);

  // Define the axes
  var xAxis = d3v5.axisBottom(x)
    .ticks(n)
    .tickFormat(d3.format("d"));
  var yAxis = d3v5.axisLeft(y);

  // Scale the range of the data
  x.domain(d3v5.extent(range, function(d) {
    return d.key;
  }));
  y.domain([0, d3v5.max(range, function(d) {
    return d.values;
  })]);

  svg.select(".y.axis")
    .call(yAxis);
  svg.select(".x.axis")
    .call(xAxis);

  updateLines(lineData,x,y);
  updateNodes(yearlyCount, x, y);
}

function updateLines(data,x,y) {
  // Define the line
  var valueline = d3v5.line()
    .x(function(d) {
      return x(d.key);
    })
    .y(function(d) {
      return y(d.values);
    })
    .curve(d3v5.curveMonotoneX);

  var lines = svg.selectAll(".line")
    .data(data);

  lines.exit()
    .attr("class", "line")
    .remove();

  lines.attr("class", "line")
    .attr("d", function(d) {
      return valueline(d.value)
    });

  lines.enter().append("path")
    .attr("class","line")
    //TODO
    .style("stroke", function(d) {
      return d.color = getFacultyColors()(d.key); })
    .attr("d", function(d) {
      return valueline(d.value)
    });
}

function updateNodes(data, x, y) {
  // Define the div for the tooltip
  var div = d3.select(".linegraph").append("div")	
    .attr("class", "tooltip")				
    .style("opacity", 0);

  var t = d3.transition()
    .duration(750);

  // JOIN new data with old elements.
  var nodes = svg.selectAll(".dot")
    .data(data);

  // EXIT old elements not present in new data.
  nodes.exit()
    .attr("class", "dot")
    .remove();

  // UPDATE old elements present in new data.
  nodes.attr("class", "dot")
    .attr("cx", function(d) {
      return x(d.key)
    })
    .attr("cy", function(d) {
      return y(d.values)
    })                 

  // ENTER new elements present in new data.
  nodes.enter().append("circle")
    .attr("class", "dot")
    .attr("cx", function(d) {
      return x(d.key)
    })
    .attr("cy", function(d) {
      return y(d.values)
    })
    .attr("r", 5)
    .on("mouseover", function(d) {		
      div.transition()		
          .duration(200)		
          .style("opacity", .9);		
      div.html(d.values+" students")	
          .style("left", (d3v5.event.pageX) + "px")		
          .style("top", (d3v5.event.pageY - 28) + "px");
      })					
      .on("mouseout", function(d) {		
          div.transition()		
              .duration(500)		
              .style("opacity", 0);	
      });

  nodes.transition(t);
}

function initializeFacultyGraph() {
  var margin = {
      top: 20,
      right: 100,
      bottom: 35,
      left: 250
    },
    width = (window.innerWidth - margin.left - margin.right) / 3,
    height = (window.innerHeight - margin.top - margin.bottom) / 2;

  svgBar = d3v5.select(".stackedbarchart").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  var facultyCount = getStudentCountPerFacultyTotal();

  var dataset = d3.layout.stack()([2012, 2013, 2014, 2015, 2016, 2017, 2018].map(function(year) {
    return facultyCount.map(function(d) {
      return {
        x: d.faculty,
        y: +d[year] || +0
      };
    });
  }));

  var y = d3.scale.ordinal()
    .domain(dataset[0].map(function(d) {
      return d.x;
    }))
    .rangeRoundBands([10, width - 60], 0.02);

  var x = d3.scale.linear()
    .domain([0, d3.max(dataset, function(d) {
      return d3.max(d, function(d) {
        return d.y0 + d.y;
      });
    })])
    .range([0,width]);

  var colors = d3v5.schemeCategory10;
  colors.length = 7;

  // Define and draw axes
  var yAxis = d3.svg.axis()
    .scale(y)
    .orient("left")
    .tickFormat(function(d) {
      return d
    });

  var xAxis = d3.svg.axis()
    .scale(x)
    .orient("bottom")
    .ticks(5)
    .tickSize(-width, 0, 0)
    .tickFormat(function(d) {
      return d
    });

  svgBar.append("g")
    .attr("class", "y axis")
    .call(yAxis);

  svgBar.append("g")
    .attr("class", "x axis")
    .attr("transform", "translate(0," + height + ")")
    .call(xAxis);

  // Create groups for each series, rects for each segment
  var groups = svgBar.selectAll("g.cost")
    .data(dataset)
    .enter().append("g")
    .attr("class", "cost")
    .style("fill", function(d, i) {
      return colors[i];
    });

  var rect = groups.selectAll("rect")
    .data(function(d) {
      return d;
    })
    .enter()
    .append("rect")
    .attr("y", function(d) {
      return y(d.x);
    })
    .attr("x", function(d) {
      return x(d.y0);
    })
    .attr("width", function(d) {
      return x(d.y0+d.y)-x(d.y0);
    })
    .attr("height", y.rangeBand())
    .on("mouseover", function() {
      tooltip.style("display", null);
    })
    .on("mouseout", function() {
      tooltip.style("display", "none");
    })
    .on("mousemove", function(d) {
      var xPosition = d3v5.mouse(this)[0] - 15;
      var yPosition = d3v5.mouse(this)[1] - 25;
      tooltip.attr("transform", "translate(" + xPosition + "," + yPosition + ")");
      tooltip.select("text").text(d.y);
    });

  var legend = svgBar.selectAll(".legend")
    .data(colors)
    .enter().append("g")
    .attr("class", "legend")
    .attr("transform", function(d, i) {
      return "translate(30," + i * 19 + ")";
    });

  legend.append("rect")
    .attr("x", width - 18)
    .attr("width", 18)
    .attr("height", 18)
    .style("fill", function(d, i) {
      return colors.slice().reverse()[i];
    });

  legend.append("text")
    .attr("x", width + 5)
    .attr("y", 9)
    .attr("dy", ".35em")
    .style("text-anchor", "start")
    .text(function(d, i) {
      return 2018-i;
    });

  // Prep the tooltip bits, initial display is hidden
  var tooltip = svgBar.append("g")
    .attr("class", "tooltip")
    .style("display", "none");

  tooltip.append("rect")
    .attr("width", 30)
    .attr("height", 20)
    .attr("fill", "white")
    .style("opacity", 0.5);

  tooltip.append("text")
    .attr("x", 15)
    .attr("dy", "1.2em")
    .style("text-anchor", "middle")
    .attr("font-size", "12px")
    .attr("font-weight", "bold");

}

function updateFacultyGraph() {
  //TODO
}

function zoomToCountry(country, coordinates, dataset) {
  updateStudentCountGraph(yearSelected[0], yearSelected[1]);
  if (view == 'country') {
    updateText(yearSelected[0], yearSelected[1], countStudentsCountry(dataset, country));
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
    if (country == datamapsCountry.properties.name) {
      var iso = datamapsCountry.properties.iso;
      countryColor = dataset[iso].color;
      colorLowerOpacity = countryColor.slice(0, countryColor.length - 1) + ', 0.2)'
      fillsZoom[iso] = colorLowerOpacity;
      datasetZoom[iso] = {
        fillKey: iso,
        borderColor: colorLowerOpacity
      };
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
      highlightBorderColor: false, //'#B7B7B7',
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

    if (view == 'university') {
      selectedUniversity = bubbles.find(obj => {
        return obj.name === selectedUniversity.name;
      });
      updateText(yearSelected[0], yearSelected[1], selectedUniversity.numberOfStudents);
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
      updateStudentCountGraph(yearSelected[0], yearSelected[1]);
      updateText(yearSelected[0], yearSelected[1], bubble.numberOfStudents);
      document.getElementById('universityName').innerHTML = bubble.name;
    });
  });
};

///HELP FUNCTIONS///
function countStudentsTotal(dataset) {
  var count = 0;
  Object.keys(dataset).forEach(function(country) {
    count += dataset[country].numberOfStudents;
  })
  return count;
}

function countStudentsCountry(dataset, country) {
  var countries = Datamap.prototype.worldTopo.objects.world.geometries;
  var iso = "";
  countries.forEach(function(item) {
    if (country == item.properties.name) {
      iso = item.properties.iso;
    }
  });
  count = dataset[iso].numberOfStudents;
  return count;
}


function getStudentCountPerYearTotal(data) {
  var yearlyCount = d3.nest()
    .key(function(d) {
      return d.Begin;
    })
    .rollup(function(leaves) {
      return leaves.length;
    })
    .entries(data);
  return yearlyCount;
}

function getStudentCountPerYearCountry(data,country) {
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
    .entries(data);
  var yearlyCountPerCountry = yearlyCount.find(obj => {
    return obj.key === country;
  }).values;
  return yearlyCountPerCountry;
}

function getStudentCountPerYearUniversity(data,university) {
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
    .entries(data);
  var yearlyCountPerUniversity = studentCount.find(obj => {
    return obj.key === university;
  }).values;
  return yearlyCountPerUniversity;
}

function getStudentCountPerFacultyTotal() {
  var yearlyCount = d3.nest()
    .key(function(d) {
      var newFac = d.Faculteit.replace("Fac. ", "");
      newFac = newFac.replace("Faculteit ", "");
      newFac = newFac.replace("Hoger Instituut voor ", "");
      return newFac;
    })
    .key(function(d) {
      return d.Begin;
    })
    .rollup(function(leaves) {
      return leaves.length;
    })
    .entries(selectedData)
    .map(function(d, i) {
      var result = {
        faculty: d.key
      }
      d.values.forEach(function(year) {
        result[year.key] = year.values;
      })
      return result
    });
  return yearlyCount;
}

function getStudentCountPerFacultyCountry(country) {
  var yearlyCount = d3.nest()
    .key(function(d) {
      return d.Land;
    })
    .key(function(d) {
      return d.Faculteit;
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

function getStudentCountPerFacultyUniversity(university) {
  var studentCount = d3.nest()
    .key(function(d) {
      return d.Uitwisselingsinstelling;
    })
    .key(function(d) {
      return d.Faculteit;
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

function updateText(begin, end, totalCount) {
  document.getElementById('begin').innerHTML = begin;
  document.getElementById('end').innerHTML = end;
  document.getElementById('totalCount').innerHTML = totalCount;
  document.getElementById('yearlyCount').innerHTML = Math.floor(totalCount / (end - begin));
}

function buildPaletteScale(values) {
  var minValue = Math.min.apply(null, values);
  var maxValue = Math.max.apply(null, values);
  var paletteScale = d3v5.scaleSequentialSqrt()
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

function getSelectedFaculties() {
  var selectedFaculties = [];
  d3.selectAll(".myCheckbox").each(function(d) {
    cb = d3.select(this);
    if (cb.property("checked")) {
      selectedFaculties.push(cb.property("value"));
    }
  });
  return selectedFaculties;
}

function toggleSidebar() {
  if(sidebarVisible){
    document.getElementById("mySidebar").style.width = "0";
    document.getElementById("main").style.marginLeft= "0";
    document.getElementById("mySidebar").style.paddingLeft = "0px";
    document.getElementById('sidebarButton').innerHTML = ">";
    document.getElementById('sidebarButton').style.left ="0";
    document.getElementById('sidebarButton').style.right ="0";
    sidebarVisible = false;
  } else {
    document.getElementById("mySidebar").style.width = "350px";
    document.getElementById("main").style.marginLeft = "350px";
    document.getElementById("mySidebar").style.paddingLeft = "40px";
    document.getElementById('sidebarButton').innerHTML = "<";
    document.getElementById('sidebarButton').style.left ="390px";
    document.getElementById('sidebarButton').style.right ="390px";
    sidebarVisible = true;
  } 
}

function getYearlyCount(data){
  var yearlyCount;
  switch (view) {
    case 'world':
      yearlyCount = getStudentCountPerYearTotal(data);
      break;
    case 'country':
      yearlyCount = getStudentCountPerYearCountry(data,selectedCountry);
      break;
    case 'university':
      yearlyCount = getStudentCountPerYearUniversity(data,selectedUniversity.name);
      break;
    default:
      yearlyCount = getStudentCountPerYearTotal(data);
    }
  return yearlyCount;
}

function getHighestCount(yearlyCount){
  var highestCount = 0;
  for(year in yearlyCount){
    if(yearlyCount[year].values > highestCount){
      highestCount = yearlyCount[year].values;
    }
  }
  return highestCount;
}

//TODO
function getFacultyColors(){
  var faculties = [
    "Fac. Psychologie en Pedagogische Wet.", 
    "Faculteit Geneeskunde", 
    "Faculteit Rechtsgeleerdheid", 
    "Faculteit Economie en Bedrijfswetensch.", 
    "Faculteit Ingenieurswetenschappen", 
    "Faculteit Letteren", 
    "Faculteit Wetenschappen", 
    "Faculteit Farmaceutische Wetenschappen", 
    "Faculteit Theologie en Religiewetensch.", 
    "Hoger Instituut voor Wijsbegeerte", 
    "FaBeR", 
    "Faculteit Sociale Wetenschappen", 
    "Faculteit Bio-ingenieurswetenschappen", 
    "Fac. Industriële Ingenieurswetenschappen", 
    "Faculteit Architectuur"
  ]

  var colorScale = d3v5.scaleSequential().domain(faculties)
    .interpolator(d3v5.interpolateViridis);

  var c20 = d3.scale.category20();

  var colors = [];
  for (i=0;i<faculties.length;i++){
    key = faculties[i];
    colors.push({key: colorScale[i]});
  }
  return c20;
}
