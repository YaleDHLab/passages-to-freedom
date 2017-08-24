---
process: true
---
(function() {
  var metadataSqlQuery = 'SELECT * FROM {{ site.carto_metadata }}';
      queryRoute = 'https://gravistar.carto.com/api/v2/sql?format=GeoJSON&q=';

  d3.json(queryRoute + metadataSqlQuery, handleData);

  function handleData(data) {
    var count = data.features.length;
    for (var i=0; i<count; i++) {
      window.setTimeout(updateCount.bind(null, i), 20*i)
    }
  }

  function updateCount(val) {
    d3.select('span').html(val)
  }

})();