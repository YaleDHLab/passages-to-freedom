import os, glob

for i in glob.glob('../assets/images/narrative_covers/*'):
  os.system('convert ' + i + ' -resize "180x" -sampling-factor 4:2:0 -quality 85 ' + i)

