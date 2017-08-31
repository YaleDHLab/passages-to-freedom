import urllib2, codecs, json, os, yaml 

with open('_config.yml') as f:
	config = yaml.load(f)

query = 'https://gravistar.carto.com/api/v2/sql?format=GeoJSON&q='
select = 'SELECT * FROM ' + config['carto_metadata']
query += '%20'.join(select.split())

request = urllib2.urlopen(query)
j = json.loads(request.read())
for i in j['features']:
  try:
    img = i['properties']['img']
    text_id = i['properties']['narrative_id']
    os.system('wget ' + img + ' -O ' + 'assets/images/narrative_covers/' + str(text_id) + '.jpg')
  except KeyError:
    pass