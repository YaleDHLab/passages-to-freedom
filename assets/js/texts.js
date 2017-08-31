---
process: true
---

(function() {

  if (!document.querySelector('.text-table')) return;

  var metadataQuery = 'SELECT * FROM {{ site.carto_metadata }}',
      routesQuery = 'SELECT * FROM {{ site.carto_routes }}',
      queryPath = 'https://gravistar.carto.com/api/v2/sql?format=GeoJSON&q=';

  d3.json(queryPath + metadataQuery, function(metadata) {
    d3.json(queryPath + routesQuery, function(routes) {
      handleJson(metadata, routes);
    })
  })

  function handleJson(metadata, routes) {
    d3.select('.text-table tbody').html(getTableData(metadata, routes));
    addClickListeners();
  }

  function getTableData(metadata, routes) {
    var narrativeIdToPassages, none = window.passages.getNarrativeIdMappings(routes),
        incomplete = window.passages.findNarrativeIdsToRemove(),
        rows = '',
        imgsToLoad = 0,
        imgsLoaded = 0;

    window.onImgLoad = function() {
      imgsLoaded++;
      if (imgsLoaded === imgsToLoad) {
        d3.select('.loader').style('opacity', 0);
        setTimeout(function() {
          d3.select('.loader').style('display', 'none')
        }, 250)

        setTimeout(function() {
          d3.select('.text-table').style('opacity', 1);
        }, 300)
      }
    }

    metadata.features.forEach(function(feature) {
      if (incomplete.indexOf(feature.properties.narrative_id.toString()) !== -1) {
        imgsToLoad += 1;
        var props = feature.properties,
            author = props.author,
            pubdate = props.date_of_publication,
            filename = props.filename,
            img = props.img,
            title = props.short_title,
            row = '<tr data-filename=' + filename + '>',
            cover = '<img src=' + img + ' onload="window.onImgLoad()">';

        if (img && author && title && pubdate) {
          [cover, author, title, pubdate].forEach(function(field) {
            row += '<td>' + field + '</td>';
          })
          rows += row + '</tr>';
        }
      }
    })
    return rows;
  }

  function addClickListeners() {
    d3.select('.text-table').selectAll('tr')
      .on('click', function(d, i) {
        var textPath = this.dataset.filename.replace('.xml', '.html');
        window.location = '{{ site.baseurl }}/texts/' + textPath;
      })
  }

})();