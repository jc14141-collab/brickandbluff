import * as T from './vendor/three.module.min.js';

// Depth-aware background softness: the wheel, ball and foreground stay sharp.
export function createRouletteFocus(renderer){
 const target=new T.WebGLRenderTarget(1,1,{depthTexture:new T.DepthTexture(1,1)}),size=new T.Vector2();
 const scene=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,0,1);
 const material=new T.ShaderMaterial({uniforms:{picture:{value:target.texture},depth:{value:target.depthTexture},texel:{value:new T.Vector2(1,1)},nearPlane:{value:.1},farPlane:{value:50},focus:{value:9.2}},vertexShader:`varying vec2 uv0;void main(){uv0=uv;gl_Position=vec4(position.xy,0.,1.);}`,fragmentShader:`
  uniform sampler2D picture;uniform sampler2D depth;uniform vec2 texel;uniform float nearPlane;uniform float farPlane;uniform float focus;varying vec2 uv0;
  void main(){float z=texture2D(depth,uv0).x;float distance=nearPlane*farPlane/(farPlane-z*(farPlane-nearPlane));float blur=smoothstep(focus+2.5,focus+7.,distance)*2.;vec2 d=texel*blur;vec3 c=texture2D(picture,uv0).rgb*4.;
   c+=texture2D(picture,uv0+vec2(d.x,0.)).rgb*2.;c+=texture2D(picture,uv0-vec2(d.x,0.)).rgb*2.;c+=texture2D(picture,uv0+vec2(0.,d.y)).rgb*2.;c+=texture2D(picture,uv0-vec2(0.,d.y)).rgb*2.;
   c+=texture2D(picture,uv0+d).rgb;c+=texture2D(picture,uv0-d).rgb;c+=texture2D(picture,uv0+vec2(d.x,-d.y)).rgb;c+=texture2D(picture,uv0+vec2(-d.x,d.y)).rgb;gl_FragColor=vec4(c/16.,1.);
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
  }`,depthTest:false,depthWrite:false});
 const plane=new T.Mesh(new T.PlaneGeometry(2,2),material);scene.add(plane);
 return {render(world,view,focusDistance=view.position.length()){renderer.getDrawingBufferSize(size);if(target.width!==size.x||target.height!==size.y){target.setSize(size.x,size.y);material.uniforms.texel.value.set(1/size.x,1/size.y)}material.uniforms.nearPlane.value=view.near;material.uniforms.farPlane.value=view.far;material.uniforms.focus.value=focusDistance;renderer.setRenderTarget(target);renderer.render(world,view);renderer.setRenderTarget(null);renderer.render(scene,camera)},dispose(){target.dispose();plane.geometry.dispose();material.dispose()}};
}
