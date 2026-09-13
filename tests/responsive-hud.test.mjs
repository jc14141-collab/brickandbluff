import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {handCard} from '../dist/guandan-ui.mjs';
test('shared blackjack hand markup contains ranks and suits with explicit light-paper ink rules',()=>{
 const css=fs.readFileSync(new URL('../dist/table-responsive.css',import.meta.url),'utf8');
 for(const [r,s,rank]of [[13,'♣','K'],[14,'♦','A'],[10,'♠','10']]){const html=handCard({r,s},0,{small:true});assert(html.includes(rank));assert(html.includes(s))}
 assert.match(css,/\.mp-table \.gd-card\{[^}]*color:#17281e!important/);assert.match(css,/\.mp-table \.gd-card.red\{[^}]*color:#ad302c!important/);
 const index=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');assert(index.indexOf('table-responsive.css')>index.indexOf('voxel-hud.css'));
});
