from __future__ import division, print_function
from collections import defaultdict
from difflib import SequenceMatcher
from bs4 import BeautifulSoup, NavigableString
from nltk import ngrams
import glob, os, urllib2, codecs, json, yaml

# built for python 2.7

tag_maps = [
  {
    'tag': 'titlepart',
    'attr': {'type' : 'main'},
    'newtag': 'h1'
  },
  {
    'tag': 'titlepart',
    'attr': {'type' : 'subtitle'},
    'newtag': 'h2'
  },
  {
    'tag': 'head',
    'attr': None,
    'newtag': 'h3'
  },
  {
    'tag': 'lb',
    'attr': None,
    'newtag': 'br'
  },
]

tags_to_remove = [
  {
    'tag': 'figure',
    'attr': None
  },
  {
    'tag': 'pb',
    'attr': None
  },
  {
    'tag': 'div1',
    'attr': {'type': 'contents'}
  }
]

block_nodes = [
  'h1',
  'h2',
  'h3',
  'p',
]

def make_outdir():
  '''
  @args: none
  @returns: none
  '''
  if not os.path.exists('_texts'):
    os.makedirs('_texts')

def remove_tags(soup):
  '''
  @args: a soup object
  @returns: a soup object without tags to remove
  '''
  for tag in tags_to_remove:
    if tag['attr']:
      [t.extract() for t in soup.find_all(tag['tag'], tag['attr'])]
    else:
      [t.extract() for t in soup.find_all(tag['tag'])]
  return soup

def convert_tags(soup):
  '''
  @args: a soup object
  @returns: a soup object with all tags converted to target html tags
  '''    
  for tag_map in tag_maps:
    tag = tag_map['tag']
    attr = tag_map['attr']
    newtag = tag_map['newtag']
    if attr:
      for node in soup.find_all(tag, attr):
        node.name = newtag
    else:
      for node in soup.find_all(tag):
        node.name = newtag

    # convert all other tei tags to spans
    for node in soup.findChildren():
      if node.name not in block_nodes:
        node.replaceWithChildren()
  return soup

def annotate_locations(xml_filename, html):
  '''
  @args: an html string
  @returns: an html string with location references annotated 
  '''
  for i in narrative_json[xml_filename]:
 
    # don't process empty passages, as there's nothing to match
    if not i['passage'].strip():
      print(' - please hand correct the tags for', xml_filename, i['cartodb_id'], 1)
      continue

    # handle the trivial case: the exact passage is in the text
    if i['passage'] in html:
      html = replace_html(html, i['passage'], i['cartodb_id'], xml_filename, 'direct')

    # handle the case where the passage has been mistranscribed
    else:
      similarity, most_similar = find_most_similar(i['passage'], html)
      if similarity > .7:
        html = replace_html(html, most_similar, i['cartodb_id'], xml_filename, 'inderect')
      else:
        print(' - please hand correct the tags for', xml_filename, i['cartodb_id'], 2)

  return html

def replace_html(html, passage, cartodb_id, xml_filename, sim_type):
  '''
  @args:
    html {str}: an html string
    passage {str}: a passage in the xml to be wrapped by tags
    cartodb_id {int}: an integer for a cartodb item id
    sim_type: {str}: a string indicating whether this is direct/indrect similarity
  @returns:
    {str} the html string with passages wrapped by spans
  '''

  _passage = None
  if '<' in passage:
    _passage = passage.split('<')[0]
  if '>' in passage:
    _passage = passage.split('>')[1]

  if _passage:
    if len(_passage)/len(passage) < .7:
      print(' - please hand correct the tags for', xml_filename, cartodb_id, 3)
      return html
    else:
      passage = _passage

  if not passage.strip() or not cartodb_id:
    print(' - passage is empty', xml_filename, cartodb_id, 5)
    return html

  replacement = '<span id="cartodb_id_' + str(cartodb_id) + '">' + passage + '</span>'

  if passage in html:
    html = html.replace(passage, replacement)
    return html

  else:
    print(' - passage could not be found', xml_filename, cartodb_id, 4, sim_type)

  return html

def find_most_similar(passage, html):
  '''
  @args:
    passage: {str} a string representing a given passage
    html: {str} a longer string represting an html doc
  @returns:
    similarity: {float} a float 0:1 indicating the similarity
      between the passage and the most similar passage identified
      within the html
    most_similar: {str} a string that contains the passage within
      html that's most similar to the input passage
  '''
  most_similar = None
  max_sim = 0 
  passage_set = set(passage.split())

  for window_words in ngrams(html.split(), len(passage.split())):
    window_set = set(window_words)
    sim = get_jaccard_sim(window_set, passage_set)

    # run a jaccard check before executing n**2 time on SequenceMatcher()
    if sim > .6:
      sim = SequenceMatcher(None, passage, ' '.join(window_words)).ratio()

    if sim > max_sim:
      max_sim = sim
      most_similar = ' '.join(window_words)

  return max_sim, most_similar

def get_jaccard_sim(seta, setb):
  '''
  @args:
    seta {set} a set of strings
    setb {set} a set of strings
  @returns:
    {float} a float indicating the jaccard sim of sets a and b
  '''
  intersection = len( seta.intersection(setb) )
  union = len( seta.union(setb) )
  return intersection / union 

def get_narrative_json():
  '''
  @args: none
  @returns: d[narrativeId] = [{location json}, {location json}...]
  '''
  d = defaultdict(list)
  narrative_id_to_filename = {}

  metadata_json = get_carto_json(metadata_table)
  for i in metadata_json['features']:
    props = i['properties']
    narrative_id_to_filename[ props['narrative_id'] ] = props['filename']

  route_json = get_carto_json(routes_table)
  for i in route_json['features']:
    props = i['properties']
    if (not props['latitude']) or (not props['longitude']):
      continue
    if (not props['placename_prior']) and (not props['placename_post']):
      continue
    p = props['placename_prior'] + ' ' + props['placename_expressed'] + ' ' + props['placename_post']

    # handle inconsistencies in the carto data
    try:
      d[ narrative_id_to_filename[ props['narrative_id'] ] ].append({
        'passage': p,
        'cartodb_id': props['cartodb_id']
      })
    except:
      continue
  return d

def get_carto_json(table_name):
  '''
  @args: the name of a carto table to query
  @returns: the table contents in json form
  '''
  url = '%20'.join((carto_root + table_name).split())
  return json.loads(urllib2.urlopen(url).read())

def add_jekyll_frontmatter(_html):
  '''
  @args: an html string
  @returns: an html string with frontmatter added
  '''
  html =  '---\n'
  html += 'layout: text\n'
  html += '---\n'
  html += _html
  return html

if __name__ == '__main__':
  with open('_config.yml') as f:
    config = yaml.load(f.read())
    routes_table = config['carto_routes']
    metadata_table = config['carto_metadata']

  make_outdir()
  carto_root = 'https://gravistar.carto.com/api/v2/sql?format=GeoJSON&q=SELECT * FROM '
  narrative_json = get_narrative_json()

  for i in glob.glob('assets/data/xml/*.xml'):
    xml_file = os.path.basename(i)
    
    # only process xml files for which location data is present
    if xml_file not in narrative_json.keys():
      continue

    with open(i) as f:
      soup = BeautifulSoup( f.read(), 'lxml' )
      text = remove_tags( soup.find('text') )
      text = convert_tags( text )

      # process the soup into html
      html = ' '.join( unicode(text.prettify()).split() )
      html = annotate_locations( xml_file, html )
      html = add_jekyll_frontmatter(html)

      outfile = os.path.basename(i).replace('.xml', '') + '.html'
      with codecs.open('_texts/' + outfile, 'w', 'utf8') as out:
        out.write(html)