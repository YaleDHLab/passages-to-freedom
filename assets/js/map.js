---
process: true
---

(function() {

  // initialize global map object
  var map = L.map('map', {
    center: [40, -75],
    zoom: 8,
    scrollWheelZoom: false,
    zoomControl: true
  });

  map.zoomControl.setPosition('bottomleft');

  // initialize global carto query params
  var mapSqlQuery = 'SELECT * FROM {{ site.carto_routes }}',
      metadataSqlQuery = 'SELECT * FROM {{ site.carto_metadata }}',
      queryRoute = 'https://gravistar.carto.com/api/v2/sql?format=GeoJSON&q=',

      // map point/line colors
      colors = [
        '#67001f','#b2182b','#d6604d', '#f4a582',
        '#92c5de','#4393c3','#2166ac','#053061'
      ],
      sortedNarrativeIds = [],  // sorted narrative ids for consistent coloring
      activeNarrativeId = null, // narrative selected by user
      distanceTimeout = null,   // setTimeout to compute distance between points
      distanceSleep = 1500,     // time to wait before updating distance measures
      jitter = .1;              // amount to jitter points

  // create global memory cache and cache the page colors
  window.passages = {
    colors: colors
  }

  // initialize a global minimap
  var miniMap = new L.Control.GlobeMiniMap({}).addTo(map);

  // begin all subsequent transactions
  initializeMap();

  /**
  * Initialize the map
  **/

  function initializeMap() {
    L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_nolabels/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="http://cartodb.com/attributions">CartoDB</a> | <a href="https://github.com/yaledhlab">&hearts; YaleDH</a>',
      subdomains: 'abcd',
      minZoom: 6,
      maxZoom: 12
    }).addTo(map);

    d3.json(queryRoute + mapSqlQuery, handleMapJson);
    addMapClearListeners();
  }

  /**
  * Clear the selected narrative on click but not drag events
  **/

  function addMapClearListeners() {
    var dragging = false,
        container = document.querySelector('#map');
    container.addEventListener('mousedown', function() {
      dragging = false;
    })
    container.addEventListener('mousemove', function() {
      dragging = true;
    })
    container.addEventListener('mouseup', function() {
      if (dragging === false) clearSelectedNarrative();
    })

    var clearButton = document.querySelector('.clear-selected-route');
    clearButton.addEventListener('click', function() {
      clearSelectedNarrative();
    })
  }

  /**
  * Callback triggered when the map point json arrives
  **/

  function handleMapJson(data) {
    var narrativeIdToPoints = getNarrativeIdToPoints(data);

    // sort the narrative ids then draw the initially visualized observations
    sortedNarrativeIds = getSortedNarrativeIds(Object.keys(narrativeIdToPoints));
    d3.json(queryRoute + metadataSqlQuery, handleMetadataJson);
    drawMapPoints();
  }

  /**
  * Map each narrative Id to that narrative's metadata
  **/

  function getNarrativeIdToMetadata(data) {
    var narrativeIdToMetadata = {};
    data.features.forEach(function(feature) {
      narrativeIdToMetadata[feature.properties.narrative_id] = {
        author: feature.properties.author,
        img: feature.properties.img,
        narrativeTitle: feature.properties.title,
        narrativeId: feature.properties.narrative_id,
        shortTitle: feature.properties.short_title
      }
    })

    window.passages.narrativeIdToMetadata = narrativeIdToMetadata;
    return narrativeIdToMetadata;
  }

  /**
  * Data processing function to map each narrative id to that narrative's
  * points and text passages
  **/

  function getNarrativeIdToPoints(data) {
    var narrativeIdToPoints = {},
        narrativeIdToPassages = {},
        points = _.sortBy(data.features, function(feature) {
          return feature.properties.cartodb_id;
        })

    points.forEach(function(feature) {
      if (feature.geometry && feature.properties.narrative_id) {
        var passage = {
          prior: feature.properties.placename_prior,
          expressed: feature.properties.placename_expressed,
          post: feature.properties.placename_post
        }

        var coordinates = feature.geometry.coordinates,
            narrativeId = feature.properties.narrative_id,
            
            // jitter the points to avoid overlap
            point = new L.latLng([
              coordinates[1] + _.random(-jitter, jitter),
              coordinates[0] + _.random(-jitter, jitter)
            ]);

        narrativeIdToPoints[narrativeId] ?
            narrativeIdToPoints[narrativeId].push(point)
          : narrativeIdToPoints[narrativeId] = [point];

        narrativeIdToPassages[narrativeId] ?
            narrativeIdToPassages[narrativeId].push(passage)
          : narrativeIdToPassages[narrativeId] = [passage];
      }
    })

    // cache the data for later line drawing
    window.passages.narrativeIdToPoints = narrativeIdToPoints;
    window.passages.narrativeIdToPassages = narrativeIdToPassages;
    return narrativeIdToPoints;
  }

  /**
  * Draw all of the initially displayed map points / lines
  **/

  function drawMapPoints() {
    sortedNarrativeIds.forEach(function(narrativeId, idx) {
      drawNarrativePoints(narrativeId.toString(), idx);
    })
  }

  /**
  * Master function for adding a narrative's points to the map
  **/

  function drawNarrativePoints(narrativeId, narrativeIdx) {
    window.passages.narrativeIdToPoints[narrativeId].forEach(function(point) {
      drawPoint(point, narrativeId, narrativeIdx)
    });
  }

  function drawPoint(latLng, narrativeId, narrativeIdx) {
    var circle = new L.circleMarker(latLng, {
      className: 'map-point narrative-id-' + narrativeId + ' visible ',
      radius: 5,
      color: colors[narrativeIdx % colors.length],
      fillColor: colors[narrativeIdx % colors.length],
      fill: true,
      fillOpacity: 0.5,
      opacity: 0.8,
    }).addTo(map);

    // add event listeners
    circle.on('click', function(e) {
      toggleNarrativeState(narrativeId)
    });
  }

  /**
  * Draw the map line for a narrative Id
  **/

  function drawNarrativeLine(narrativeId) {
    var narrativeIdx = sortedNarrativeIds.indexOf(narrativeId),
        narrativeId = parseInt(narrativeId)

    new L.polyline(window.passages.narrativeIdToPoints[narrativeId], {
      color: colors[narrativeIdx % colors.length],
      weight: 3,
      opacity: .4,
      smoothFactor: .5,
      dashArray: '3, 6',
      className: 'map-line narrative-id-' + narrativeId
    }).addTo(map)
  }

  /**
  * Toggle the state of a given narrative
  **/

  function toggleNarrativeState(narrativeId) {
    clearSelectedNarrative();
    if (narrativeId === activeNarrativeId) {
      activeNarrativeId = null;
    } else {
      activeNarrativeId = narrativeId;
      activateNarrative(narrativeId);
    }
  }

  /**
  * Select a narrative, draw its line, add its location text, and scroll to that text
  * @called:
  *   on click of a point from a narrative
  *   on click of a narrative card
  **/

  function activateNarrative(narrativeId) {
    darkenAllPointsExcept(narrativeId);
    displayLocationText(narrativeId);
    scrollToNarrativeCard(narrativeId);
    d3.select('.clear-selected-route').style('display', 'inline-block');
    d3.select('.distance-container').style('display', 'inline-block');
    setTimeout(focusOnPoint.bind(null, narrativeId, 0), 500);
  }

  /**
  * Darken the map points/lines except those that belong to the given narrative id
  * @called:
  *   by selectNarrative()
  **/

  function darkenAllPointsExcept(narrativeId) {
    d3.selectAll('.map-point')
      .style('opacity', function(d) {
        return d3.select(this).attr('class').includes('narrative-id-' + narrativeId + ' ') ?
            1
          : 0.1
      })
  }

  /**
  * Display the text snippets with location passages for a narrativeId
  **/

  function displayLocationText(narrativeId) {
    var elem = document.querySelector('.location-text.narrative-id-' + narrativeId),
        passages = window.passages.narrativeIdToPassages[narrativeId],
        text = '';

    passages.forEach(function(p, idx) {
      text += '<div class="passage-dash"></div>';
      text += '<div class="passage-dash"></div>';
      text += '<div class="passage-dash"></div>';
      text += '<div class="passage card"';
      text +=   'onclick="focusOnPoint(' + narrativeId + ',' + idx + ')">';
      text +=     p.prior + ' <b>' + p.expressed + '</b> ' + p.post;
      text += '</div>';
    });

    elem.innerHTML = text;
  }

  function scrollToNarrativeCard(narrativeId) {
    var elem = document.querySelector("[data-narrative-id='" + narrativeId + "']");
    document.querySelector('.cards').scrollTop = elem.offsetTop;
  }

  /**
  * Deselect the active narrative by hiding its line, passage cards, and passage dashes
  **/

  function clearSelectedNarrative() {
    brightenPoints();
    d3.selectAll('.map-line').remove();
    d3.selectAll('.location-text').html('');
    d3.select('.clear-selected-route').style('display', 'none');
    d3.select('.distance').html('0');
    d3.select('.distance-container').style('display', 'none');
  }

  /**
  * Restore the opacity of all map points/lines
  **/

  function brightenPoints() {
    d3.selectAll('.map-point')
      .style('opacity', 1)
      .style('pointerEvents', 'initial')
  }

  /**
  * Global callbacks for location card events
  **/

  window.focusOnPoint = function(narrativeId, targetPointIdx) {

    // fly to the point with idx === targetPointIdx in this narrative
    var narrativePoints = window.passages.narrativeIdToPoints[narrativeId];
    map.flyTo(narrativePoints[targetPointIdx], 9, {
      animate: true,
      duration: 1.5,
      easeLinearity: 1
    })

    // darken all other points in this narrative
    d3.selectAll('.map-point.narrative-id-' + narrativeId)
      .style('opacity', function(d, i) {
        return i === targetPointIdx ? 1 : 0.2;
      })

    // highlight the location text card we're looking at
    d3.select('.location-text.narrative-id-' + narrativeId).selectAll('.passage.card')
      .classed('active', function(d, i) {
        return i === targetPointIdx ? true : false;
      });

    // scroll the cards so users can keep clicking through
    if (targetPointIdx > 0) {
      var container = document.querySelector('.location-text.narrative-id-' + narrativeId),
        cardHeight = container.querySelectorAll('.passage.card')[targetPointIdx].clientHeight;
      document.querySelector('.cards').scrollTop += cardHeight + 30;
    };

    // update the progress bar to show how far through the narrative we've made it
    var percentComplete = ((targetPointIdx+1)/narrativePoints.length) * 100;
    setTimeout(function() {
      d3.select('.progress-inner').style('width', percentComplete + '%')
    }, distanceSleep)

    updateMilesTravelled(narrativeId, targetPointIdx);
  }

  /**
  * Compute distance travelled on journey
  **/

  function updateMilesTravelled(narrativeId, targetPointIdx) {
    // update the total distance travelled by this traveller
    clearTimeout(distanceTimeout);
    var distanceTravelled = getDistanceTravelled(narrativeId, targetPointIdx),
        extantDistance = parseInt(d3.select('.distance').html()),
        delta = distanceTravelled - extantDistance;

    if (Math.abs(delta) > 1000) {
      var timeout = .01;
    } else if (Math.abs(delta) > 100) {
      var timeout = 2;
    } else {
      var timeout = 20;
    }

    setTimeout(function() {
      var val = delta > 0 ? 1 : -1;
      for (var i=0; i<Math.abs(delta); i++) {
        distanceTimeout = setTimeout(updateDistanceTravelled.bind(null, distanceTravelled, val), timeout*i)
      }
    }, distanceSleep)
  }

  /**
  * @author:
  *   GeoDataSource: http://www.geodatasource.com/developers/javascript
  **/

  function distanceBetweenPoints(lat1, lon1, lat2, lon2, unit) {
    var radlat1 = Math.PI * lat1/180;
    var radlat2 = Math.PI * lat2/180;
    var theta = lon1-lon2;
    var radtheta = Math.PI * theta/180;
    var dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
    dist = Math.acos(dist);
    dist = dist * 180/Math.PI;
    dist = dist * 60 * 1.1515;
    if (unit=='K') { dist = dist * 1.609344 } // kilometers
    if (unit=='N') { dist = dist * 0.8684 }   // nautical miles
    return dist;
  }

  function getDistanceTravelled(narrativeId, narrativeIdx) {
    var distance = 0,
        narrativePoints = window.passages.narrativeIdToPoints[narrativeId.toString()];
    if (narrativeIdx === 0) return 0;
    for (var i=1; i<narrativeIdx+1; i++) {
      var one = narrativePoints[i],
          two = narrativePoints[i-1];
      distance += distanceBetweenPoints(one.lat, one.lng, two.lat, two.lng);
    }
    return distance;
  }

  function updateDistanceTravelled(distanceTravelled, val) {
    console.log(val)
    var extantDistance = parseInt(d3.select('.distance').html());
    d3.select('.distance').html(extantDistance+val);
  }

  /**
  * Create cards and card event listeners
  **/

  function handleMetadataJson(data) {
    var narrativeIdToMetadata = getNarrativeIdToMetadata(data);
    createCards(narrativeIdToMetadata);
  }

  /**
  * Custom sort to ensure cards for narratives that are active
  * on page load appear at the top of the list
  **/

  function getSortedNarrativeIds(narrativeIds) {
    narrativeIds.map(Number);
    return _.shuffle(narrativeIds);
  }

  /**
  * Draw the narrative cards and add them to the dom
  **/

  function createCards(narrativeIdToMetadata) {
    var cardData = '';
    sortedNarrativeIds.forEach(function(narrativeId, narrativeIdx) {
      var metadata = narrativeIdToMetadata[narrativeId],
          color = colors[narrativeIdx % colors.length];

      if (metadata.img && metadata.author && metadata.shortTitle) {
        var card = '';
        card += '<div class="card-container" data-narrative-id=' + narrativeId + '>'
        card +=   '<div class="card">';
        card +=     '<img src="{{ site.baseurl }}/assets/images/narrative_covers/' + narrativeId + '.jpg">';
        card +=     '<div class="card-text">';
        card +=       '<h2 class="author">' + metadata.author + '</h2>';
        card +=       '<div class="short-title">' + metadata.shortTitle + '</div>';
        card +=     '</div>';
        card +=     '<div class="card-dark-overlay"></div>';
        card +=   '</div>';
        card +=   '<div class="location-text narrative-id-' + narrativeId + '"></div>';
        card += '</div>';
        cardData += card;
      }
    })

    d3.select('.cards').html(cardData);
    addCardClickListeners();
  }

  /**
  * Add all event listeners to the cards
  **/

  function addCardClickListeners() {
    d3.selectAll('.card')
      .on('click', function(d, i) {
        toggleNarrativeState(this.parentNode.dataset.narrativeId)
      })
  }

})();