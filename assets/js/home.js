(function() {

  if (!document.querySelector('#text-count')) return;

  var routesQuery = 'SELECT * FROM table_34_reordered_data',
      queryPath = 'https://gravistar.carto.com/api/v2/sql?format=GeoJSON&q=';

  d3.json(queryPath + routesQuery, handleData);

  function handleData(data) {
    var narrativeIdToPassages, none = window.passages.getNarrativeIdMappings(data);
    var incomplete = window.passages.findNarrativeIdsToRemove(),
        narratives = _.keys(window.passages.narrativeIdToPassages),
        count = narratives.length - incomplete.length;
    _.times(count, function(i) {
      window.setTimeout(updateCount.bind(null, i), 20*i)
    })
  }

  function updateCount(val) {
    d3.select('span').html(val)
  }

})();