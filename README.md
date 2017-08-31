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

## Application Overview

```
The _includes folder: this folder contains html partials 
The _layouts folder: this folder contains a series of page layouts
The _texts folder: this folder contains .html versions of the .xml files that we want to deeplink to
The Assets folder: this folder contains all of the css, javascript, images et al.
The Utils folder: this folder contains all the python brains
The .html files in the root directory provide the html for the different paths through the site
The gitignore file tells Git what file extensions to ignore (e.g. .swp Vim files)
Gemfile and the auto-generated Gemfile.lock contain the Ruby dependencies, of which there is only one now (Jekyll)
_config.yml is the central configuration file for the application and for Jekyll
```

## Instructions for committing changes to the master and ghpages branches

```
# install homebrew
/usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"

# install imagemagick
brew install imagemagick

# install sublime text
https://www.sublimetext.com/3

# clone repository to machine
git clone https://github.com/YaleDHLab/passages-to-freedom/

# change directories into repository folder
cd passages-to-freedom

# install the ruby version manager
brew install rbenv

# initialize rbenv
rbenv init

# append the following to the bash profile
echo 'eval "$(rbenv init -)" ' > ~/.bash_profile

# source the bash profile in order to allow version of ruby to run in current terminal session
source ~/.bash_profile

# install a version of ruby
rbenv install 2.4.1

# use ruby 2.4.1 within current directory 
rbenv local 2.4.1

# install bundler
gem install bundler

# install jekyll
gem install jekyll

# install dependencies
bundle install

# start web server
bundle exec jekyll serve

# option: to change port (use a number above 5000)
bundle exec jekyll serve --port 5000

# open the webpage
open -a "Google Chrome" http://localhost:4000/passages-to-freedom/

# make any changes to the application code from the command line with Sublime
sudo ln -s /Applications/Sublime\ Text.app/Contents/SharedSupport/bin/subl /usr/local/bin/subl3

# then enter in command line:
sublime .

# Preview the changes to make sure everything looks good/runs
```
