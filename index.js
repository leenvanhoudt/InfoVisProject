d3.csv("Datasets/Erasmus Data/Dataset Bert Willems/UIT Totaal (Filtered).csv", function(error, csv_data) {

  csv_data.forEach(function(student) {
    student.Begin = parseInt(student.Begin);
    student.Eind = parseInt(student.Eind);
  });

  var yearSelected = [2012, 2019];
  var dataset = makeDataset(csv_data,yearSelected);
  console.log(dataset);
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
          zoomToCountry(geography.properties.name, countryData.latlng);
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
      return {
        path: path,
        projection: projection
      };
    },
    height: 300,
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
        return;
      }
    }
  });

  slider.noUiSlider.on('update',function(values,handle){
    console.log("updated");
    yearSelected[handle] = parseInt(values[handle]);
    var dataset = makeDataset(csv_data,yearSelected);
    overviewMap.updateChoropleth(dataset);
    //zoomedMap.updateChoropleth(dataset);
  })

  function zoomToCountry(country, coordinates) {
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
      .entries(csv_data);
    var countryStudentCount = studentCount.find(obj => {
      return obj.key === country;
    }).values;

    // Build color scale
    var studentPerUniValues = Object.keys(countryStudentCount).map(function(key) {
      return countryStudentCount[key].values
    });
    var minValue = Math.min.apply(null, studentPerUniValues);
    var maxValue = Math.max.apply(null, studentPerUniValues);

    var paletteScale = d3v5.scaleSequential()
      .interpolator(d3v5.interpolateOrRd)
      .domain([minValue, maxValue]);

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

    var countryColor = '#DEDEDE';
    var countries = Datamap.prototype.worldTopo.objects.world.geometries;
    countries.forEach(function(datamapsCountry) {
      if (country==datamapsCountry.properties.name) {
        var iso = datamapsCountry.properties.iso;
        countryColor = dataset[iso].color;
        colorLowerOpacity = countryColor.slice(0,countryColor.length-1)+ ', 0.2)'
        fillsZoom[iso] = colorLowerOpacity;
        datasetZoom[iso] = {fillKey: iso};
      }
    });

    console.log(datasetZoom);
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
          return fills[geo.fillKey] || '#F5F5F5';
        },
        // only change border
        highlightBorderColor: '#B7B7B7',
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
        var coordinates = getRandomCoordinates(countryData.latlng[0], countryData.latlng[1], 2);
        //bubbles.push({name: countryStudentCount[i].key, latitude: coordinates[0], longitude: coordinates[1], radius: countryStudentCount[i].values, fillKey: 'BEL'});
        bubbles.push({
          name: countryStudentCount[i].key,
          latitude: coordinates[0],
          longitude: coordinates[1],
          radius: 10,
          fillKey: countryStudentCount[i].key,
        });
      }
      zoomedMap.bubbles(bubbles, {
        popupTemplate: function(geo, data) {
          return ['<div class="hoverinfo">',
            '<strong>', data.name, '</strong>',
            '<br># Students: <strong>', data.numberOfStudents, '</strong>',
            '</div>'
          ].join('');
        }
      });
    })
  };
});



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
  var minValue = Math.min.apply(null, studentValues);
  var maxValue = Math.max.apply(null, studentValues);

  var paletteScale = d3v5.scaleSequential()
    .interpolator(d3v5.interpolateOrRd)
    .domain([minValue, maxValue]);

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
