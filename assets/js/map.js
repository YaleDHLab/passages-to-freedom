---
process: true
---

(function() {

  // initialize global map object
  var mapStart = {
    position: [39.75, -75.75],
    zoom: 8,
    targetId: 'map'
  };

  // initialize global carto query params
  var mapSqlQuery = 'SELECT * FROM {{ site.carto_routes }}',
      metadataSqlQuery = 'SELECT * FROM {{ site.carto_metadata }}',
      queryRoute = 'https://gravistar.carto.com/api/v2/sql?format=GeoJSON&q=',

      // map point/line colors
      colors = [
        '#67001f','#b2182b','#d6604d', '#f4a582',
        '#92c5de','#4393c3','#2166ac','#053061'
      ],
      timeouts = [],             // timeouts running on the page
      sortedNarrativeIds = [],   // sorted narrative ids for consistent coloring
      activeNarrativeId = null,  // narrative selected by user
      distanceSleep = 1500,      // time to wait before updating distance measures
      jitter = .1;               // amount to jitter points

  // create global memory cache and cache the page colors
  window.passages = {
    focus: {},
    colors: colors,
    getNarrativeIdMappings: getNarrativeIdMappings,
    findNarrativeIdsToRemove: findNarrativeIdsToRemove
  }

  // initialize the map
  if (!document.querySelector('#' + mapStart.targetId)) return;
  var map = L.map(mapStart.targetId, {
    center: mapStart.position,
    zoom: mapStart.zoom,
    scrollWheelZoom: false,
    zoomControl: true
  });
  map.zoomControl.setPosition('bottomleft');

  // initialize a minimap
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
    addLocationButtonListeners();
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
    clearButton.addEventListener('click', clearSelectedNarrative)
  }

  /**
  * Callback triggered when the map point json arrives
  **/

  function handleMapJson(data) {
    var narrativeIdToPassages, narrativeIdToPoints = getNarrativeIdMappings(data),
        narrativeIdsToRemove = findNarrativeIdsToRemove();

    // sort the narrative ids then draw the initially visualized observations
    sortedNarrativeIds = getSortedNarrativeIds(Object.keys(narrativeIdToPoints));
    sortedNarrativeIds = _.difference(sortedNarrativeIds, narrativeIdsToRemove);
    d3.json(queryRoute + metadataSqlQuery, handleMetadataJson);
    drawMapPoints();
  }

  /**
  * Remove narratives with missing data
  **/

  function findNarrativeIdsToRemove() {
    var narrativeIdsToRemove = [],
        narrativeIdToPassages = window.passages.narrativeIdToPassages;
    Object.keys(narrativeIdToPassages).forEach(function(narrativeId) {
      var passages = narrativeIdToPassages[narrativeId],
          missingData = 0;
      for (var i=0; i<passages.length; i++) {
        if (passages[i].prior === '' || passages[i].post === '') {
          missingData += 1;
        }
      }
      if (missingData/passages.length > .3) {
        narrativeIdsToRemove.push(narrativeId)
      }
    })
    return narrativeIdsToRemove;
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
        narrativeId: feature.properties.narrative_id,
        shortTitle: feature.properties.short_title,
        fullTitle: feature.properties.title,
        year: feature.properties.date_of_publication
      }
    })

    window.passages.narrativeIdToMetadata = narrativeIdToMetadata;
    return narrativeIdToMetadata;
  }

  /**
  * Data processing function to map each narrative id to that narrative's
  * points and text passages
  **/

  function getNarrativeIdMappings(data) {
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
    return narrativeIdToPassages, narrativeIdToPoints;
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
    var narrativePoints = window.passages.narrativeIdToPoints[narrativeId];
    narrativePoints.forEach(function(pointLatLng, pointIdx) {
      drawPoint(pointLatLng, pointIdx, narrativeId, narrativeIdx)
    });
  }

  function drawPoint(pointLatLng, pointIdx, narrativeId, narrativeIdx) {
    var className =  'map-point narrative-id-' + narrativeId;
    className += ' point-index-' + narrativeIdx;
    var circle = new L.circleMarker(pointLatLng, {
      className: className,
      radius: 6,
      color: colors[narrativeIdx % colors.length],
      fillColor: colors[narrativeIdx % colors.length],
      fill: true,
      fillOpacity: 0.75,
      opacity: 0.8,
    }).addTo(map);

    // add event listeners
    circle.on('click', function(e) {
      toggleNarrativeState(narrativeId, pointIdx);
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

  function toggleNarrativeState(narrativeId, pointIndex=0) {
    clearSelectedNarrative();
    if (narrativeId === activeNarrativeId) {
      activeNarrativeId = null;
    } else {
      activeNarrativeId = narrativeId;
      activateNarrative(narrativeId, pointIndex);
    }
  }

  /**
  * Select a narrative, draw its line, add its location text, and scroll to that text
  * @called:
  *   on click of a point from a narrative
  *   on click of a narrative card
  **/

  function activateNarrative(narrativeId, pointIdx=0) {
    clearTimeouts();
    updateLocationButtons(narrativeId, pointIdx);
    setNarrativeTitle(narrativeId);
    darkenAllPointsExcept(narrativeId);
    displayLocationText(narrativeId);
    scrollToNarrativeCard(narrativeId, pointIdx);
    d3.select('.distance').html('0');
    d3.select('.clear-selected-route').style('display', 'inline-block');
    d3.select('.distance-container').style('display', 'inline-block');
    timeouts.push(setTimeout(focusOnPoint.bind(null, narrativeId, pointIdx), 500));
  }

  /**
  * Indicate to users what narrative we're looking at
  **/

  function setNarrativeTitle(narrativeId) {
    var metadata = window.passages.narrativeIdToMetadata[narrativeId];
    d3.select('.selected-narrative-container').style('display', 'inline-block');
    d3.select('.selected-narrative-title').html(metadata.shortTitle);
    d3.select('.selected-narrative-author').html(metadata.author);
  }

  /**
  * Darken the map points/lines except those that belong to the given narrative id
  * @called:
  *   by selectNarrative()
  **/

  function darkenAllPointsExcept(narrativeId) {
    d3.selectAll('.map-point')
      .style('opacity', function(d) {
        var targetClass = 'narrative-id-' + narrativeId + ' ';
        return d3.select(this).attr('class').includes(targetClass) ? 1 : 0.1;
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
      text += p.prior || p.expressed || p.post ?
          trim(p.prior) + ' <b>' + trim(p.expressed) + '</b> ' + trim(p.post)
        : '[No data available for this location]';
      text += '</div>';
    });

    elem.innerHTML = text;
  }

  /**
  * Trim exterior whitespace
  **/

  function trim(s) {
    return (s || '').replace( /^\s+|\s+$/g, '');
  }

  /**
  * Scroll to a given narrative card, then to a location card
  **/

  function scrollToNarrativeCard(narrativeId, pointIndex) {
    pointIndex = parseInt(pointIndex);
    var narrativeCardQuery = "[data-narrative-id='" + narrativeId + "']",
        narrativeCard = document.querySelector(narrativeCardQuery),
        locationCard = narrativeCard.querySelectorAll('.passage.card')[pointIndex],
        locationCardHeight = locationCard.clientHeight,
        container = document.querySelector('.cards');

    container.scrollTop = pointIndex === 0 ?
        narrativeCard.offsetTop
      : locationCard.offsetTop - locationCardHeight - 30;
  }

  /**
  * Deselect the active narrative by hiding its line, passage cards, and passage dashes
  **/

  function clearSelectedNarrative() {
    clearTimeouts();
    activeNarrativeId = null;
    brightenPoints();
    d3.selectAll('.map-line').remove();
    d3.selectAll('.location-text').html('');
    d3.select('.distance').html('0');
    d3.select('.clear-selected-route').style('display', 'none');
    d3.select('.distance-container').style('display', 'none');
    d3.select('.selected-narrative-container').style('display', 'none');
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

  window.focusOnPoint = function(narrativeId, pointIdx) {
    pointIdx = parseInt(pointIdx);
    window.passages.focus = {narrativeId: narrativeId, pointIdx: pointIdx};
    flyToPoint(narrativeId, pointIdx);
    scrollLocationCards(narrativeId, pointIdx);
    updatePercentComplete(narrativeId, pointIdx);
    updateMilesTravelled(narrativeId, pointIdx);
    updateLocationButtons(narrativeId, pointIdx);

    // darken all other points in this narrative
    d3.selectAll('.map-point.narrative-id-' + narrativeId)
      .style('opacity', function(d, i) {
        return i === pointIdx ? 1 : 0.2;
      })

    // highlight the location text card we're looking at
    d3.select('.location-text.narrative-id-' + narrativeId).selectAll('.passage.card')
      .classed('active', function(d, i) {
        return i === pointIdx ? true : false;
      });
  }

  /**
  * Fly to a point in a narrative
  **/

  function flyToPoint(narrativeId, pointIdx) {
    var narrativePoints = window.passages.narrativeIdToPoints[narrativeId];
    map.flyTo(narrativePoints[pointIdx], 9, {
      animate: true,
      duration: 1.5,
      easeLinearity: 1
    })
  }

  /**
  * Scroll the location cards so users can continue clicking through
  **/

  function scrollLocationCards(narrativeId, pointIdx) {
    if (pointIdx > 0) {
      var container = document.querySelector('.location-text.narrative-id-' + narrativeId),
        cardHeight = container.querySelectorAll('.passage.card')[pointIdx].clientHeight;
      document.querySelector('.cards').scrollTop += cardHeight + 25;
    };
  }

  /**
  * Update the bar indicating how much of the journey is complete
  **/

  function updatePercentComplete(narrativeId, pointIdx) {
    var narrativePoints = window.passages.narrativeIdToPoints[narrativeId],
        percentComplete = ((pointIdx+1)/narrativePoints.length) * 100;
    timeouts.push(setTimeout(function() {
      d3.select('.progress-inner').style('width', percentComplete + '%')
    }, distanceSleep))
  }

  /**
  * Compute distance travelled on journey
  **/

  function updateMilesTravelled(narrativeId, pointIdx) {
    // update the total distance travelled by this traveller
    //clearTimeout(distanceTimeout);
    var distanceTravelled = getDistanceTravelled(narrativeId, pointIdx),
        extantDistance = parseInt(d3.select('.distance').html()),
        delta = distanceTravelled - extantDistance,
        timeout = getTimeoutVal();

    timeouts.push(setTimeout(function() {
      var val = delta > 0 ? 1 : -1;
      for (var i=0; i<Math.abs(delta); i++) {
        distanceTimeout = timeouts.push(setTimeout(
          updateDistanceTravelled.bind(null, distanceTravelled, val), timeout*i
        ))
      }
    }, distanceSleep))
  }

  /**
  * Determine the timeout to use for distance travelled animations
  **/

  function getTimeoutVal(delta) {
    if (Math.abs(delta) > 10000) {
      return .0001;
    } else if (Math.abs(delta) > 1000) {
      return .001;
    } else if (Math.abs(delta) > 100) {
      return 2;
    } else {
      return 20;
    }
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

  function getDistanceTravelled(narrativeId, pointIdx) {
    var distance = 0,
        narrativePoints = window.passages.narrativeIdToPoints[narrativeId.toString()];
    if (pointIdx === 0) return 0;
    for (var i=1; i<pointIdx+1; i++) {
      var one = narrativePoints[i],
          two = narrativePoints[i-1];
      distance += distanceBetweenPoints(one.lat, one.lng, two.lat, two.lng);
    }
    return distance;
  }

  function updateDistanceTravelled(distanceTravelled, val) {
    var extantDistance = parseInt(d3.select('.distance').html());
    d3.select('.distance').html(extantDistance+val);
  }

  /**
  * Update the state of the next and previous location buttons
  **/

  function updateLocationButtons(narrativeId, pointIdx) {
    var narrativePoints = window.passages.narrativeIdToPoints[narrativeId];
    var previousDisabled = pointIdx === 0 ? true : false;
    var nextDisabled = pointIdx+1 === narrativePoints.length ? true : false;
    d3.select('.previous-location').classed('disabled', previousDisabled);
    d3.select('.next-location').classed('disabled', nextDisabled);
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
        card += '<div class="card-container" data-narrative-id=' + narrativeId + '>';
        card +=   '<div class="card">';
        card +=     '<img src="{{ site.baseurl }}/assets/images/narrative_covers/' + narrativeId + '.jpg">';
        card +=     '<div class="card-text">';
        card +=       '<h2 class="author">' + metadata.author + '</h2>';
        card +=       '<div class="year">' + metadata.year + '</div>';
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
    d3.selectAll('.card').on('click', function(d, i) {
      toggleNarrativeState(this.parentNode.dataset.narrativeId)
    })
  }

  /**
  * Callbacks for buttons that allow users to page through location cards
  **/

  function addLocationButtonListeners() {
    var previousButton = document.querySelector('.previous-location'),
        nextButton = document.querySelector('.next-location');
    previousButton.addEventListener('mousedown', decrementPointIndex)
    nextButton.addEventListener('mousedown', incrementPointIndex)
  }

  function decrementPointIndex(e) {
    e.preventDefault();
    e.stopPropagation();
    var focus = window.passages.focus;
    focusOnPoint(focus.narrativeId, focus.pointIdx-1);
  }

  function incrementPointIndex(e) {
    e.preventDefault();
    e.stopPropagation();
    var focus = window.passages.focus;
    focusOnPoint(focus.narrativeId, focus.pointIdx+1);
  }

  /**
  * Helper to clear all active timeouts
  **/

  function clearTimeouts() {
    while (timeouts.length) {
      var t = timeouts.pop();
      clearTimeout(t);
    }
  }

})();