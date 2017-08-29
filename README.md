# Passages to Freedom
> Mapping the journeys American slaves took to freedom.

Passages to Freedom is an experiment in visualizing the paths nineteenth-century Americans took to escape from slavery. Using a simple interface, users can explore these routes and follow the autobiographical narratives of the slaves who escaped into free territory.

![App preview](/assets/images/preview.png?raw=true)

## Getting Started

```
# install dependencies
bundle exec bundle install

# start web server
bundle exec jekyll serve

# open the webpage
open -a "Google Chrome" http://localhost:4000/passages-to-freedom/
```

## Data Sources

Location data is retrieved from CartoDB. The specific tables queried are identified in `_config.yml`.

Text data is derived from The University of North Carolina's [North American Slave Narratives](http://docsouth.unc.edu/neh/) corpus. The data may be downloaded and processed with the following commands:

```
# install wget and wget xml data
brew install wget && wget https://s3-us-west-2.amazonaws.com/lab-apps/passages-to-freedom/data/north-american-slave-narrative-xml.tar.gz -O assets/data/xml.tar.gz

# unzip xml data
tar -zxf assets/data/xml.tar.gz && mv xml assets/data/ && rm assets/data/xml.tar.gz

# install python requirements
pip install -r utils/requirements.txt

# process xml data (python 2.7)
python utils/convert_xml_to_html.py
```