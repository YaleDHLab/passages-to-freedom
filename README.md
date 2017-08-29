# Passages to Freedom
> Mapping the journeys American slaves took to freedom.

Passages to Freedom is an experiment in visualizing the paths nineteenth-century Americans took to escape from slavery. Using a simple interface, users can explore these routes and follow the autobiographical narratives of the slaves who escaped into free territory.

![App preview](/assets/images/preview.png?raw=true)

## Getting Started

```
# install dependencies
bundle exec bundle install

# install wget command and fetch xml data
brew install wget && wget https://s3-us-west-2.amazonaws.com/lab-apps/passages-to-freedom/data/north-american-slave-narrative-xml.tar.gz -O assets/data/

# start web server
bundle exec jekyll serve
```

## Data Sources

Location data is retrieved from CartoDB. The specific tables queried are identified in `_config.yml`.

Text data is derived from The University of North Carolina's [North American Slave Narratives](http://docsouth.unc.edu/neh/) corpus. The data may be downloaded and processed with the following commands:

```
wget https://s3-us-west-2.amazonaws.com/lab-apps/passages-to-freedom/data/north-american-slave-narrative-xml.tar.gz -O assets/data/xml.tar.gz
tar -zxf assets/data/xml.tar.gz && mv xml assets/data/ && rm assets/data/xml.tar.gz
pip install -r utils/requirements.txt
python utils/convert_xml_to_html.py
```