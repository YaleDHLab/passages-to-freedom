(function() {

  var metadataSqlQuery = 'SELECT * FROM table_34_narratives_metadata',
      queryRoute = 'https://gravistar.carto.com/api/v2/sql?format=GeoJSON&q=';

  d3.json(queryRoute + metadataSqlQuery, handleMetadataJson);

  function handleMetadataJson(data) {
    d3.select('.text-table tbody').html(getTableData(data))
    addClickListeners();
  }

  function getTableData(data) {
    var rows = '';
    data.features.forEach(function(feature) {
      var props = feature.properties,
          author = props.author,
          pubdate = props.date_of_publication,
          filename = props.filename,
          img = props.img,
          title = props.short_title,
          row = '<tr data-filename=' + filename + '>',
          cover = '<img src=' + img + '>';

      if (cover, author, title, pubdate) {
        [cover, author, title, pubdate].forEach(function(field) {
          row += '<td>' + field + '</td>';
        })
        rows += row + '</tr>';
      }
    })
    return rows;
  }

  function addClickListeners() {
    d3.select('.text-table').selectAll('tr')
      .on('click', function(d, i) {
        window.location = '/passages-to-freedom/texts/' + this.dataset.filename;
      })
  }

})();