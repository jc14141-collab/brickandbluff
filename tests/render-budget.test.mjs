import test from 'node:test';
import assert from 'node:assert/strict';
import {gemMaterial,renderPixelRatio} from '../dist/voxel-art.mjs';
test('background gems avoid transmission and high DPI buffers respect the pixel budget',()=>{
 const material=gemMaterial(0x884433);assert(material.isMeshStandardMaterial);assert(!material.transmission);assert(material.emissiveIntensity>0);
 for(const [w,h,dpr]of [[1024,1366,2],[2732,2048,2],[1920,1080,1],[390,844,3]]){const ratio=renderPixelRatio(dpr,w,h);assert(ratio<=dpr);assert(ratio<=1.5);assert(w*h*ratio*ratio<=1800001)}
 material.dispose();
});
