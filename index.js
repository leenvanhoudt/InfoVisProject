var overviewMap;
var zoomedMap;
var originalData;
var selectedData;
var selectedCountry;
var selectedCountryCoordinates;
var countryTranslations = {};
//selectedUniversity = object with all info about the selected university
var selectedUniversity;
var svg;
var svgMap;
var svgBar;
var svgUni;
var yearSelected;
//view = 'world', 'country' or 'university'
var view = 'world';
var sidebarVisible = false;
var allFacultiesSelected = true;

d3.csv("Datasets/Erasmus Data/Dataset Bert Willems/UIT Totaal (Filtered).csv", function(error, csv_data) {
  csv_data.forEach(function(student) {
    student.Begin = parseInt(student.Begin);
    student.Eind = parseInt(student.Eind);
  });

  d3.csv("Datasets/Landnamen.csv", function(error, csv_translation) {
    csv_translation.forEach(function(country) {
      countryTranslations[country.ENG] = country.NL;
    });
  });

  originalData = csv_data;
  selectedData = csv_data;
  yearSelected = [2012, 2019];

  var dataset = makeDataset(csv_data);
  updateText(yearSelected[0], yearSelected[1], countStudentsTotal(dataset));

  initializeView(dataset);

  d3.select(".allCheckbox").on("change", checkAll);
  d3.selectAll(".myCheckbox").on("change", checkSingle);
  d3v5.select(".radioTotal").on("change", checkRadioButtonTotal);
  d3v5.select(".radioComparison").on("change", checkRadioButtonComparison);

  slider.noUiSlider.on('update', function(values, handle) {
    yearSelected[handle] = parseInt(values[handle]);
    update();
  });

  function checkAll() {
    if (d3.select(".allCheckbox").property("checked")) {
      d3.selectAll(".myCheckbox").property("checked", true);
    } else {
      d3.selectAll(".myCheckbox").property("checked", false);
    }
    update();
  }

  function checkSingle() {
    if (d3.select(".allCheckbox").property("checked")) {
      d3.select(".allCheckbox").property("checked", false);
    } else if ($("input.myCheckbox").not(":checked").length === 0) {
      d3.select(".allCheckbox").property("checked", true);
    }
    update();
  }

  function checkRadioButtonComparison() {
    d3.select(".radioTotal").property("checked", false)
    d3.select(".radioComparison").property("checked", true)
    document.getElementById("container3").style.visibility = "hidden";
    allFacultiesSelected = false;
    update();
  }

  function checkRadioButtonTotal() {
    d3.select(".radioTotal").property("checked", true)
    d3.select(".radioComparison").property("checked", false)
    document.getElementById("container3").style.visibility = "visible";
    allFacultiesSelected = true;
    update();
  }
});

function update() {
  selectedData = updateSelectedData(originalData, yearSelected[0], yearSelected[1], getSelectedFaculties(false));
  var dataset = makeDataset(selectedData);
  if (Object.keys(dataset).length === 0) {
    dataset = makeDummySet(originalData);
  }
  overviewMap.updateChoropleth(dataset);
  //updateHeatmapLegend(dataset);

  if (view == 'country' || view == 'university') {
    zoomToCountry(selectedCountry, selectedCountryCoordinates, dataset);
    //graphs en text worden geupdate in de zoomToCountry function
  } else {
    updateStudentCountGraph(yearSelected[0], yearSelected[1]);
    updateText(yearSelected[0], yearSelected[1], countStudentsTotal(dataset));
    updateFacultyGraph();
    updateUniversityGraph();
    resetSmallMap();
  }
}

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
  initializeStudentCountGraph();
  //TODO
  initializeFacultyGraph();
  initializeUniversityGraph();
  resetSmallMap();
}

function initializeMaps(dataset) {
  //map config
  overviewMap = new Datamap({
    element: document.getElementById('container1'),
    //set projection to Europe
    setProjection: function(element, options) {
      var projection = d3.geo.mercator()
        .center([10, 50])
        .scale(600)
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
        //document.getElementById('countryName').innerHTML = geography.properties.name;
        //document.getElementById('universityName').innerHTML = "";
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
    height: 400,
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
          '<strong>', countryTranslations[geo.properties.name], '</strong>',
          '<br># Studenten: <strong>', data.numberOfStudents, '</strong>',
          '</div>'
        ].join('');
      }
    }
  });

  svgMap = d3v5.select(".container1").append("svg")
  // Legend
  svgMap.append("g")
    .attr("class", "legend")
    .attr("transform", function(d, i) {
      return "translate(40," + i * 19 + ")";
    });
  console.log(dataset);
}

function updateHeatmapLegend(dataset) {
  var data = getHeatmapRange(dataset);
  var legend = svg.select("g.legend");

  var rect = legend.selectAll(".legend.rect")
    .data(data);

  var text = legend.selectAll(".legend.text")
    .data(data);

  rect.exit()
    .attr("class", "legend rect")
    .remove()

  text.exit()
    .attr("class", "legend text")
    .remove()

  rect.attr("class", "legend rect")
    .attr("x", width - 18)
    .attr("y", function(d, i) {
      return i * 20;
    })
    .attr("width", 18)
    .attr("height", 18)
    .style("fill", function(d) {
      return d.value;
    });

  text.attr("class", "legend text")
    .attr("x", width + 5)
    .attr("y", function(d, i) {
      return i * 20 + 9;
    })
    .attr("dy", ".35em")
    .style("text-anchor", "start")
    .text(function(d) {
      return d.key;
    });

  rect.enter().append("rect")
    .attr("class", "legend rect")
    .attr("x", width - 18)
    .attr("y", function(d, i) {
      return i * 20;
    })
    .attr("width", 18)
    .attr("height", 18)
    .style("fill", function(d) {
      return d.value;
    });

  text.enter().append("text")
    .attr("class", "legend text")
    .attr("x", width + 5)
    .attr("y", function(d, i) {
      return i * 20 + 9;
    })
    .attr("dy", ".35em")
    .style("text-anchor", "start")
    .text(function(d) {
      return d.key;
    });
}

function getHeatmapRange(dataset) {
  range = {};
  var max = 0;
  var maxCountry;
  var min = 2000;
  var minCountry;
  for(country in dataset){
    if(country!='BEL'){
      if(dataset[country].numberOfStudents>max){
        maxCountry = dataset[country];
        max = dataset[country].numberOfStudents
      }else if(dataset[country].numberOfStudents<min){
        minCountry = dataset[country];
        min = dataset[country].numberOfStudents;
      }
    }
  }
}

function initializeStudentCountGraph() {
  var margin = {
      top: 50,
      right: 50,
      bottom: 50,
      left: 80
    },
    width = (window.innerWidth - margin.left - margin.right) / 3 + 180,
    height = (window.innerHeight - margin.top - margin.bottom) / 2 - 50;

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

  // X axis label
  svg.append("text")
    .attr("class", "axis label")
    .attr("text-anchor", "end")
    .attr("x", width - 250)
    .attr("y", height + margin.top - 10)
    .text("Jaar");

  // Y axis label
  svg.append("text")
    .attr("class", "axis label")
    .attr("text-anchor", "end")
    .attr("transform", "rotate(-90)")
    .attr("y", -margin.left + 10)
    .attr("x", -margin.top + 30)
    .text("Aantal studenten")

  // Graph title
  svg.append("text")
    .attr("class", "axis title")
    .attr("x", (width / 2))
    .attr("y", 0 - (margin.top / 2))
    .attr("text-anchor", "end")
    .text("Aantal studenten per jaar");

  // Legend
  svg.append("g")
    .attr("class", "legend")
    .attr("transform", function(d, i) {
      return "translate(40," + i * 19 + ")";
    });

  // Nodes
  svg.append("g")
    .attr("class", "dot")

  updateStudentCountGraph(begin, end);
}

function updateStudentCountGraph(begin, end) {
  var margin = {
      top: 50,
      right: 50,
      bottom: 50,
      left: 50
    },
    width = (window.innerWidth - margin.left - margin.right) / 3 - 50,
    height = (window.innerHeight - margin.top - margin.bottom) / 2 - 50;

  //number of datapoints
  var n = end - begin;

  var yRange;
  var xRange;
  var lineData = [];
  if (allFacultiesSelected) {
    var yearlyCount = getYearlyCount(selectedData);
    yRange = yearlyCount;
    xRange = yearlyCount;
    lineData.push({
      key: 'Totaal',
      value: yearlyCount
    });
  } else {
    var faculties = getSelectedFaculties(false);
    var highestCount = 0;
    var start = 2018;
    var end = 2012;
    for (i = 0; i < faculties.length; i++) {
      var facultyData = updateSelectedData(selectedData, yearSelected[0], yearSelected[1], [faculties[i]]);
      var yearlyCount = getYearlyCount(facultyData);
      lineData.push({
        key: faculties[i],
        value: yearlyCount
      });
      if (getHighestCount(yearlyCount) > highestCount) {
        yRange = yearlyCount;
        highestCount = getHighestCount(yearlyCount);
      }
      if (yearlyCount.length > 0 && getYearRange(yearlyCount)[0] <= start && getYearRange(yearlyCount)[1] >= end) {
        xRange = yearlyCount;
        start = getYearRange(yearlyCount)[0];
        end = getYearRange(yearlyCount)[1];
      }
    }
  }

  // Set the ranges
  var x = d3v5.scaleLinear().range([0, width]);
  var y = d3v5.scaleLinear().range([height, 0]);

  var yTicks = getSmartTicks(d3v5.max(yRange, function(d) {
    return d.values;
  }), height);

  // Define the axes
  var xAxis = d3v5.axisBottom(x)
    .ticks(n)
    .tickFormat(d3.format("d"));
  var yAxis = d3v5.axisLeft(y)
    .ticks(yTicks.count)
    .tickFormat(d3.format("d"));

  // Scale the range of the data
  x.domain(d3v5.extent(xRange, function(d) {
    return d.key;
  }));
  y.domain([0, yTicks.endPoint]);

  svg.select(".y.axis")
    .call(yAxis);
  svg.select(".x.axis")
    .call(xAxis);

  //svg.data(lineData)

  updateLines(lineData, x, y);
  updateLegend(lineData, width);
  updateNodes(lineData, x, y);
}

function updateLines(data, x, y) {
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
    .style("stroke", function(d) {
      var colorScale = getFacultyColors();
      return colorScale(d.key);
    })
    .attr("d", function(d) {
      return valueline(d.value)
    });

  lines.enter().append("path")
    .attr("class", "line")
    .style("stroke", function(d) {
      var colorScale = getFacultyColors();
      return colorScale(d.key);
    })
    .attr("d", function(d) {
      return valueline(d.value)
    });
}

function updateLegend(data, width) {
  console.log(data);
  var legend = svg.select("g.legend");

  var rect = legend.selectAll(".legend.rect")
    .data(data);

  var text = legend.selectAll(".legend.text")
    .data(data);

  rect.exit()
    .attr("class", "legend rect")
    .remove()

  text.exit()
    .attr("class", "legend text")
    .remove()

  rect.attr("class", "legend rect")
    .attr("x", width - 18)
    .attr("y", function(d, i) {
      return i * 20;
    })
    .attr("width", 18)
    .attr("height", 18)
    .style("fill", function(d) {
      var colorScale = getFacultyColors();
      return colorScale(d.key)
    });

  text.attr("class", "legend text")
    .attr("x", width + 5)
    .attr("y", function(d, i) {
      return i * 20 + 9;
    })
    .attr("dy", ".35em")
    .style("text-anchor", "start")
    .text(function(d) {
      var shortFaculties = getFacultiesShorterNames();
      return shortFaculties[d.key];
    });

  rect.enter().append("rect")
    .attr("class", "legend rect")
    .attr("x", width - 18)
    .attr("y", function(d, i) {
      return i * 20;
    })
    .attr("width", 18)
    .attr("height", 18)
    .style("fill", function(d) {
      var colorScale = getFacultyColors();
      return colorScale(d.key)
    });

  text.enter().append("text")
    .attr("class", "legend text")
    .attr("x", width + 5)
    .attr("y", function(d, i) {
      return i * 20 + 9;
    })
    .attr("dy", ".35em")
    .style("text-anchor", "start")
    .text(function(d) {
      var shortFaculties = getFacultiesShorterNames();
      return shortFaculties[d.key];
    });
}

function updateNodes(data, x, y) {
  // Define the div for the tooltip
  var div = d3.select(".linegraph").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

  var t = d3.transition()
    .duration(750);

  var nodes = svg.selectAll("g.dot")
    .data(data)

  nodes.exit()
    .attr("class", "dot")
    .remove();

  nodes.attr("class", "dot")
    .style("fill", function(d) {
      var colorScale = getFacultyColors();
      return colorScale(d.key);
    });

  var merge = nodes.enter().append("g")
    .attr("class", "dot")
    .style("fill", function(d) {
      var colorScale = getFacultyColors();
      return colorScale(d.key);
    });

  var circles = merge.merge(nodes)
    .selectAll("circle")
    .data(function(d) {
      return d.value;
    })

  circles.exit()
    .attr("class", "dot")
    .remove();

  circles.attr("class", "dot")
    .attr("cx", function(d) {
      return x(d.key)
    })
    .attr("cy", function(d) {
      return y(d.values)
    })

  circles.enter().append("circle")
    .attr("class", "dot")
    .attr("cx", function(d) {
      return x(d.key)
    })
    .attr("cy", function(d) {
      return y(d.values)
    })
    .attr("r", 5)
    .on("mouseover", function(d, i) {
      div.transition()
        .duration(200)
        .style("opacity", .9);
      div.html(d.values + " studenten")
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
      top: 50,
      right: 50,
      bottom: 180,
      left: 80
    },
    width = (window.innerWidth - margin.left - margin.right) / 3 + 150,
    height = (window.innerHeight - margin.top - margin.bottom) / 2 - 50;

  svgBar = d3v5.select(".facultygraph").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  svgBar.append("g")
    .attr("class", "y axis");

  svgBar.append("g")
    .attr("class", "x axis")
    .attr("transform", "translate(0," + height + ")");

  // Graph title
  svgBar.append("text")
    .attr("class", "axis title")
    .attr("x", (width / 2))
    .attr("y", 0 - (margin.top / 2))
    .attr("text-anchor", "end")
    .text("Aantal studenten per faculteit");
}

function updateFacultyGraph() {
  var margin = {
      top: 50,
      right: 50,
      bottom: 180,
      left: 50
    },
    width = (window.innerWidth - margin.left - margin.right) / 3 - 50,
    height = (window.innerHeight - margin.top - margin.bottom) / 2 - 50;

  var facultyCount;
  switch (view) {
    case 'world':
      facultyCount = getStudentCountPerFacultyTotal();
      break;
    case 'country':
      facultyCount = getStudentCountPerFacultyCountry(selectedCountry);
      break;
    case 'university':
      facultyCount = getStudentCountPerFacultyUniversity(selectedUniversity.name);
      break;
    default:
      facultyCount = getStudentCountPerFacultyTotal();
  }

  var dataset = d3.layout.stack()([2012, 2013, 2014, 2015, 2016, 2017, 2018].map(function(year) {
    return facultyCount.map(function(d) {
      return {
        x: d.faculty,
        y: +d[year] || +0
      };
    });
  }));

  var x = d3.scale.ordinal()
    .domain(dataset[0].map(function(d) {
      return d.x;
    }).sort())
    .rangeRoundBands([10, width - 10], 0.1);

  var yTicks = getSmartTicks(d3.max(dataset, function(d) {
    return d3.max(d, function(d) {
      return d.y0 + d.y;
    });
  }), height);

  var y = d3.scale.linear()
    .domain([0, yTicks.endPoint])
    .range([height, 0]);

  //var colors = d3v5.schemeCategory10;
  //colors.length = 7;
  //var colors = ["#ecf8f8", "#3baba3", "#c6ebe9", "#2e857e", "#7ad1cb", "#215f5a", "#a0deda"];
  var colors = ["#3fb7ae", "#0a4f4e", "#9dd84e", "#2f882d", "#2ce462", "#304f9b", "#83acf3"];
  /*var colors = [
    "#576A8A",
    "#56CE96",
    "#5C3A51",
    "#CAF270",
    "#3A1A1C",
    "#2A9FA7"];
  var colors = [
    "#50D6EE",
    "#38CDB0",
    "#6EBB6F",
    "#9BA242",
    "#B8853A",
    "#C16A4F",
    "#683627"];*/


  // Define the axes
  var xAxis = d3.svg.axis()
    .scale(x)
    .orient("bottom")
    .tickFormat(function(d) {
      return d
    });

  var yAxis = d3v5.axisLeft(y)
    .ticks(yTicks.count)
    .tickFormat(d3.format("d"));

  svgBar.select(".y.axis")
    .call(yAxis)
    .append("text")
    .attr("class", "axis label")
    .attr("transform", "rotate(-90)")
    .attr("y", 6)
    .attr("dy", "-5em")
    .attr("dx", "-10em")
    .style("text-anchor", "start")
    .text("Aantal studenten");

  svgBar.select(".x.axis")
    .call(xAxis)
    .selectAll("text")
    .style("text-anchor", "end")
    .attr("dx", "-.9em")
    .attr("dy", ".25em")
    .attr("transform", "rotate(-50)");

  // Create groups for each series, rects for each segment
  var groups = svgBar.selectAll("g.cost")
    .data(dataset);

  groups.exit().remove();

  groups.enter().append("g")
    .attr("class", "cost")
    .style("fill", function(d, i) {
      return colors[i];
    });

  var rect = groups.selectAll("rect")
    .data(function(d) {
      return d;
    });

  rect.exit()
    .remove();

  rect.attr("class", "rect")
    .attr("x", function(d) {
      return x(d.x);
    })
    .attr("y", function(d) {
      return y(d.y0 + d.y);
    })
    .attr("height", function(d) {
      return -y(d.y0 + d.y) + y(d.y0);
    })
    .attr("width", x.rangeBand());

  rect.enter()
    .append("rect")
    .attr("x", function(d) {
      return x(d.x);
    })
    .attr("y", function(d) {
      return y(d.y0 + d.y);
    })
    .attr("height", function(d) {
      return -y(d.y0 + d.y) + y(d.y0);
    })
    .attr("width", x.rangeBand())
    .on("mouseover", function(d) {
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
    })

  var t = d3v5.transition()
    .duration(750);
  rect.transition(t);

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
      return 2018 - i;
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

function initializeUniversityGraph() {
  var margin = {
      top: 50,
      right: 200,
      bottom: 50,
      left: 50
    },
    width = (window.innerWidth - margin.left - margin.right) / 5,
    height = (window.innerHeight - margin.top - margin.bottom) / 4;

  svgUni = d3v5.select(".topUniversitiesGraph").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  svgUni.append("g")
    .attr("class", "y axis");

  svgUni.append("g")
    .attr("class", "x axis")
    .attr("transform", "translate(0," + height + ")");
}

function updateUniversityGraph() {
  var margin = {
      top: 50,
      right: 100,
      bottom: 50,
      left: 50
    },
    width = (window.innerWidth - margin.left - margin.right) / 5,
    height = (window.innerHeight - margin.top - margin.bottom) / 4;

  var universityCount;
  switch (view) {
    case 'world':
      universityCount = getStudentCountPerUniversityTotal(5);
      break;
    case 'country':
      universityCount = getStudentCountPerUniversityCountry(selectedCountry, 5);
      break;
    case 'university':
      universityCount = getStudentCountPerUniversityCountry(selectedCountry, 5);
      break;
    default:
      universityCount = getStudentCountPerUniversityTotal(5);
  }

  var dataset = d3.layout.stack()(getAllFaculties(true).map(function(faculty) {
    return universityCount.map(function(d) {
      return {
        x: d.university,
        y: +d[faculty] || +0
      };
    });
  }));

  var x = d3.scale.ordinal()
    .domain(dataset[0].map(function(d) {
      return d.x;
    }))
    .rangeRoundBands([10, width - 10], 0.1);

  var yTicks = getSmartTicks(d3.max(dataset, function(d) {
    return d3.max(d, function(d) {
      return d.y0 + d.y;
    });
  }), height);

  var y = d3.scale.linear()
    .domain([0, yTicks.endPoint])
    .range([height, 0]);

  var colors = [];
  var colorScale = getFacultyColors(true);
  getAllFaculties(true).forEach(function(faculty, i) {
    colors.push({
      "faculty": faculty,
      "color": colorScale(faculty)
    })
  });

  // Define and draw axes
  var yAxis = d3.svg.axis()
    .scale(y)
    .ticks(yTicks.count)
    .tickSize(-width, 0, 0)
    .orient("left")
    .tickFormat(function(d) {
      return d
    });

  var xAxis = d3.svg.axis()
    .scale(x)
    .orient("bottom")
    .tickFormat(function(d) {
      return d
    });

  svgUni.select(".y.axis")
    .call(yAxis)
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", 6)
    .attr("dy", "-6em")
    .attr("dx", "-15em")
    .style("text-anchor", "end")
    .text("Students");


  svgUni.select(".x.axis")
    .call(xAxis)
    .selectAll("text")
    .call(wrap, x.rangeBand());

  // Create groups for each series, rects for each segment
  var groups = svgUni.selectAll("g.cost")
    .data(dataset);

  groups.exit().remove();

  groups.enter().append("g")
    .attr("class", "cost")
    .style("fill", function(d, i) {
      return colors[i].color;
    });

  var rect = groups.selectAll("rect")
    .data(function(d) {
      return d;
    });

  rect.exit()
    .remove();

  rect.attr("class", "rect")
    .attr("x", function(d) {
      return x(d.x);
    })
    .attr("y", function(d) {
      return y(d.y0 + d.y);
    })
    .attr("height", function(d) {
      return -y(d.y0 + d.y) + y(d.y0);
    })
    .attr("width", x.rangeBand());

  rect.enter()
    .append("rect")
    .attr("x", function(d) {
      return x(d.x);
    })
    .attr("y", function(d) {
      return y(d.y0 + d.y);
    })
    .attr("height", function(d) {
      return -y(d.y0 + d.y) + y(d.y0);
    })
    .attr("width", x.rangeBand())
    .on("mouseover", function(d) {
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
    })

  var t = d3v5.transition()
    .duration(750);
  rect.transition(t);


  var legend = svgUni.selectAll(".legend")
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
    .style("fill", function(d) {
      return d.color;
    });

  legend.append("text")
    .attr("x", width + 5)
    .attr("y", 9)
    .attr("dy", ".35em")
    .style("text-anchor", "start")
    .text(function(d, i) {
      return d.faculty;
    });

  // Prep the tooltip bits, initial display is hidden
  var tooltip = svgUni.append("g")
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

function resetSmallMap() {
  var dataset = {
    'BEL': {
      fillKey: 'Belgium'
    }
  };
  var fills = {
    defaultFill: '#F5F5F5',
    Belgium: '#3FB8AF',
    'BEL': 'Belgium'
  };
  $("#container2").empty();
  zoomedMap = new Datamap({
    //scope: 'world',
    element: document.getElementById('container2'),
    //set projection to Europe
    setProjection: function(element, options) {
      var projection = d3.geo.mercator()
        .center([5, 51])
        .scale(1500)
        .translate([element.offsetWidth / 2, element.offsetHeight / 2]);
      var path = d3.geo.path()
        .projection(projection);
      return {
        path: path,
        projection: projection
      };
    },
    height: 250,
    fills: fills,
    data: dataset,
    geographyConfig: {
      borderColor: '#DEDEDE',
      highlightBorderWidth: 3,
      // don't change color on mouse hover
      highlightFillColor: function(geo) {
        return fills[geo.fillKey] || '#F5F5F5';
      },
      // only change border
      highlightBorderColor: false, //'#B7B7B7',
      // show desired information in tooltip
      popupTemplate: function(geo, data) {
        return;
      }
    }
  });
}

function zoomToCountry(country, coordinates, dataset) {
  addCountryBreadcrumb();
  updateStudentCountGraph(yearSelected[0], yearSelected[1]);
  updateFacultyGraph();
  updateUniversityGraph();

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
    height: 250,
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
      bubbles.push({
        name: countryStudentCount[i].key,
        latitude: coordinates[0],
        longitude: coordinates[1],
        radius: 10,
        fillKey: countryStudentCount[i].key,
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
          '<br># Studenten: <strong>', datasetZoom[data.name].numberOfStudents, '</strong>',
          '</div>'
        ].join('');
      }
    });

    d3.selectAll(".datamaps-bubble").on('click', function(bubble) {
      view = 'university';
      selectedUniversity = bubble;
      updateStudentCountGraph(yearSelected[0], yearSelected[1]);
      updateFacultyGraph();
      updateUniversityGraph();
      updateText(yearSelected[0], yearSelected[1], bubble.numberOfStudents);
      //document.getElementById('universityName').innerHTML = bubble.name;
      addUniversityBreadcrumb()
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

function getStudentCountPerYearCountry(data, country) {
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
  });
  if (yearlyCountPerCountry == undefined) {
    return [];
  } else {
    return yearlyCountPerCountry.values;
  }

}

function getStudentCountPerYearUniversity(data, university) {
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
  });
  if (yearlyCountPerUniversity == undefined) {
    return [];
  } else {
    return yearlyCountPerUniversity.values;
  }
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
    .entries(selectedData);
  var yearlyCountPerCountry = yearlyCount.find(obj => {
    return obj.key === country;
  }).values.map(function(d, i) {
    var result = {
      faculty: d.key
    }
    d.values.forEach(function(year) {
      result[year.key] = year.values;
    })
    return result
  });;
  return yearlyCountPerCountry;
}

function getStudentCountPerFacultyUniversity(university) {
  var yearlyCount = d3.nest()
    .key(function(d) {
      return d.Uitwisselingsinstelling;
    })
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
    .entries(selectedData);

  var yearlyCountPerUniversity = yearlyCount.find(obj => {
    return obj.key === university;
  }).values.map(function(d, i) {
    var result = {
      faculty: d.key
    }
    d.values.forEach(function(year) {
      result[year.key] = year.values;
    })
    return result
  });;
  return yearlyCountPerUniversity;
}

function getStudentCountPerUniversityTotal(max) {
  var yearlyCount = d3.nest()
    .key(function(d) {
      return d.Uitwisselingsinstelling;
    })
    .key(function(d) {
      var newFac = d.Faculteit.replace("Fac. ", "");
      newFac = newFac.replace("Faculteit ", "");
      newFac = newFac.replace("Hoger Instituut voor ", "");
      return newFac;
    })
    .rollup(function(leaves) {
      return leaves.length;
    })
    .entries(selectedData)
    .map(function(d, i) {
      var sum = 0;
      var result = {
        university: d.key
      };
      d.values.forEach(function(faculty) {
        result[faculty.key] = faculty.values;
        sum += faculty.values;
      });
      result.total = sum;
      return result
    });
  yearlyCount.sort(function(a, b) {
    return b.total - a.total;
  });

  if (yearlyCount.length > max)
    yearlyCount.length = max;
  return yearlyCount;
}

function getStudentCountPerUniversityCountry(country, max) {
  var yearlyCount = d3.nest()
    .key(function(d) {
      return d.Land;
    })
    .key(function(d) {
      return d.Uitwisselingsinstelling;
    })
    .key(function(d) {
      var newFac = d.Faculteit.replace("Fac. ", "");
      newFac = newFac.replace("Faculteit ", "");
      newFac = newFac.replace("Hoger Instituut voor ", "");
      return newFac;
    })
    .rollup(function(leaves) {
      return leaves.length;
    })
    .entries(selectedData);

  var yearlyCountPerCountry = yearlyCount.find(obj => {
    return obj.key === country;
  }).values.map(function(d, i) {
    var sum = 0;
    var result = {
      university: d.key
    };
    d.values.forEach(function(faculty) {
      result[faculty.key] = faculty.values;
      sum += faculty.values;
    });
    result.total = sum;
    return result
  });

  yearlyCountPerCountry.sort(function(a, b) {
    return b.total - a.total;
  });

  if (yearlyCountPerCountry.length > max)
    yearlyCountPerCountry.length = max;
  return yearlyCountPerCountry;
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

function getSelectedFaculties(filter) {
  var selectedFaculties = [];
  d3.selectAll(".myCheckbox").each(function(d) {
    cb = d3.select(this);
    if (cb.property("checked")) {
      if (!filter) {
        selectedFaculties.push(cb.property("value"));
      } else {
        var newFac = cb.property("value").replace("Fac. ", "");
        newFac = newFac.replace("Faculteit ", "");
        newFac = newFac.replace("Hoger Instituut voor ", "");
        selectedFaculties.push(newFac);
      }
    }
  });
  return selectedFaculties;
}

function getAllFaculties(filter) {
  var allFaculties = [];
  d3.selectAll(".myCheckbox").each(function(d) {
    cb = d3.select(this);
    if (!filter) {
      allFaculties.push(cb.property("value"));
    } else {
      var newFac = cb.property("value").replace("Fac. ", "");
      newFac = newFac.replace("Faculteit ", "");
      newFac = newFac.replace("Hoger Instituut voor ", "");
      allFaculties.push(newFac);
    }

  });
  return allFaculties;
}

function toggleSidebar() {
  if (sidebarVisible) {
    document.getElementById("mySidebar").style.width = "0";
    document.getElementById("main").style.marginLeft = "0";
    document.getElementById("mySidebar").style.paddingLeft = "0px";
    document.getElementById('sidebarButton').innerHTML = ">";
    document.getElementById('sidebarButton').style.left = "0";
    document.getElementById('sidebarButton').style.right = "0";
    sidebarVisible = false;
  } else {
    document.getElementById("mySidebar").style.width = "350px";
    document.getElementById("main").style.marginLeft = "350px";
    document.getElementById("mySidebar").style.paddingLeft = "40px";
    document.getElementById('sidebarButton').innerHTML = "<";
    document.getElementById('sidebarButton').style.left = "390px";
    document.getElementById('sidebarButton').style.right = "390px";
    sidebarVisible = true;
  }

}

function getSmartTicks(val) {

  //base step between nearby two ticks
  var step = Math.pow(10, val.toString().length - 1);

  //modify steps either: 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000...
  if (val / step < 2) {
    step = step / 5;
  } else if (val / step < 5) {
    step = step / 2;
  }

  //add one more step if the last tick value is the same as the max value
  //if you don't want to add, remove "+1"
  var slicesCount = Math.ceil((val + 1) / step);

  return {
    endPoint: slicesCount * step,
    count: Math.min(10, slicesCount) //show max 10 ticks
  }
}

function getYearlyCount(data) {
  var yearlyCount;
  switch (view) {
    case 'world':
      yearlyCount = getStudentCountPerYearTotal(data);
      break;
    case 'country':
      yearlyCount = getStudentCountPerYearCountry(data, selectedCountry);
      break;
    case 'university':
      yearlyCount = getStudentCountPerYearUniversity(data, selectedUniversity.name);
      break;
    default:
      yearlyCount = getStudentCountPerYearTotal(data);
  }
  return yearlyCount;
}

function getHighestCount(yearlyCount) {
  var highestCount = 0;
  for (year in yearlyCount) {
    if (yearlyCount[year].values > highestCount) {
      highestCount = yearlyCount[year].values;
    }
  }
  return highestCount;
}

function getYearRange(yearlyCount) {
  var start = yearlyCount[0].key;
  var end = yearlyCount[Object.keys(yearlyCount).length - 1].key;
  return [start, end];
}

//TODO
function getFacultyColors(filter) {
  if (!filter) {
    var faculties = [
      "Totaal",
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
  } else {
    var faculties = [
      "Totaal",
      "Psychologie en Pedagogische Wet.",
      "Geneeskunde",
      "Rechtsgeleerdheid",
      "Economie en Bedrijfswetensch.",
      "Ingenieurswetenschappen",
      "Letteren",
      "Wetenschappen",
      "Farmaceutische Wetenschappen",
      "Theologie en Religiewetensch.",
      "Wijsbegeerte",
      "FaBeR",
      "Sociale Wetenschappen",
      "Bio-ingenieurswetenschappen",
      "Industriële Ingenieurswetenschappen",
      "Architectuur"
    ]
  }

  /*var color = d3.scale.ordinal()
    .domain(faculties)
    .range(['#3FB8AF',"#18c61a", "#9817ff", "#d31911", "#24b7f1", "#fa82ce", "#736c31", "#1263e2", "#18c199", "#ed990a", "#f2917f", "#7b637c", "#a8b311", "#a438c0", "#d00d5e", "#1e7b1d"]);*/
  var color = d3v5.scaleOrdinal().domain(faculties)
    .range(['#3FB8AF', '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe', '#008080', '#e6beff', '#9a6324', '#800000', '#aaffc3']);
  //.range(["rgb(114,229,239)", "rgb(44,74,94)", "rgb(115,240,46)", "rgb(128,25,103)", "rgb(153,214,131)", "rgb(212,95,234)", "rgb(89,146,58)", "rgb(113,37,189)", "rgb(243,197,250)", "rgb(19,90,194)", "rgb(28,241,163)", "rgb(147,49,28)", "rgb(255,162,112)", "rgb(11,83,19)", "rgb(250,85,122)"]);
  //.range(["rgb(82,239,153)", "rgb(16,75,109)", "rgb(165,203,235)", "rgb(21,81,38)", "rgb(35,219,225)", "rgb(119,49,41)", "rgb(181,226,135)", "rgb(214,7,36)", "rgb(12,168,46)", "rgb(95,134,183)", "rgb(76,243,44)", "rgb(214,118,94)", "rgb(120,157,35)", "rgb(5,149,122)", "rgb(248,204,166)"]);
  //.range(["rgb(160,227,183)", "rgb(17,103,126)", "rgb(152,218,29)", "rgb(43,114,231)", "rgb(163,201,254)", "rgb(37,107,51)", "rgb(28,241,163)", "rgb(90,67,22)", "rgb(32,216,253)", "rgb(46,229,45)", "rgb(162,127,39)", "rgb(220,218,94)", "rgb(210,197,171)", "rgb(255,185,71)","rgb(214,7,36)"]);
  //.range(['#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe', '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000', '#aaffc3', '#808000']);

  return color;
}

function addCountryBreadcrumb() {
  var li = document.getElementById('countryBreadcrumb');
  if (li == null) {
    li = document.createElement('li');
    li.setAttribute('id', "countryBreadcrumb");
    document.getElementById('breadcrumbs').appendChild(li);
  }
  var nextLi = document.getElementById("universityBreadcrumb");
  if (nextLi != null) {
    removeElement("universityBreadcrumb");
  }

  li.innerHTML = countryTranslations[selectedCountry];
  var previousLi = document.getElementById("worldBreadcrumb");
  previousLi.innerHTML = '<a href="javascript:switchToWorldView()">Europa</a>';
}

function addUniversityBreadcrumb() {
  var li = document.getElementById("universityBreadcrumb");
  if (li == null) {
    var li = document.createElement('li');
    li.setAttribute('id', "universityBreadcrumb");
    document.getElementById('breadcrumbs').appendChild(li);
  }

  li.innerHTML = selectedUniversity.name;
  var previousLi = document.getElementById("countryBreadcrumb");
  previousLi.innerHTML = '<a href="javascript:switchToCountryView()">' + countryTranslations[selectedCountry] + '</a>';
}

function switchToCountryView() {
  removeElement("universityBreadcrumb");
  var previousLi = document.getElementById("countryBreadcrumb");
  previousLi.innerHTML = countryTranslations[selectedCountry];
  view = 'country';
  update();
}

function switchToWorldView() {
  removeElement("countryBreadcrumb");
  if (document.getElementById("universityBreadcrumb") != null) {
    removeElement("universityBreadcrumb");
  }
  var previousLi = document.getElementById("worldBreadcrumb");
  previousLi.innerHTML = 'Europa';
  view = 'world';
  update();
}

function removeElement(elementId) {
  var element = document.getElementById(elementId);
  element.parentNode.removeChild(element);
}

function getFacultiesShorterNames() {
  var faculties = [
    "Totaal",
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
  shortFaculties = {};
  faculties.forEach(function(faculty) {
    var newFac = faculty.replace("Fac. ", "");
    newFac = newFac.replace("Faculteit ", "");
    newFac = newFac.replace("Hoger Instituut voor ", "");
    shortFaculties[faculty] = newFac;
  })
  return shortFaculties;
}

function wrap(text, width) {
  text.each(function() {
    var text = d3.select(this),
      words = text.text().split(/\s+/).reverse(),
      word,
      line = [],
      lineNumber = 0,
      lineHeight = 1.1, // ems
      y = text.attr("y"),
      dy = parseFloat(text.attr("dy")),
      tspan = text.text(null).append("tspan").attr("x", 0).attr("y", y).attr("dy", dy + "em");
    while (word = words.pop()) {
      line.push(word);
      tspan.text(line.join(" "));
      if (tspan.node().getComputedTextLength() > width) {
        line.pop();
        tspan.text(line.join(" "));
        line = [word];
        tspan = text.append("tspan").attr("x", 0).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
      }
    }
  });
}
