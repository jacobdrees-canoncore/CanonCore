# PROTOTYPE, throwaway: builds PROTOTYPE-structure.html from real TMDB + Tardis Fandom data.
import json
old = json.load(open('../library-model/data.json'))
new = json.load(open('data.json'))
data = {'fetchedAt': old['fetchedAt'], 'who': {'shows': old['shows'], 'timelines': old['timelines'], 'fandomByTmdb': old['fandomByTmdb']},
        'friends': new['friends'], 'cloneWars': new['cloneWars'], 'starWars': new['starWars']}
html = open('PROTOTYPE-template.html').read().replace('/*DATA*/null', json.dumps(data, separators=(',', ':')))
open('PROTOTYPE-structure.html', 'w').write(html)
print('built', len(html) // 1024, 'KB')
