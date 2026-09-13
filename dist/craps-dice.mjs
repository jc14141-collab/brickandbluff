import * as T from './vendor/three.module.min.js';
export const FACE_VALUES=[3,4,1,6,2,5];
export function faceQuaternion(value,yaw=0){const q=new T.Quaternion();if(value===2)q.setFromAxisAngle(new T.Vector3(1,0,0),-Math.PI/2);if(value===5)q.setFromAxisAngle(new T.Vector3(1,0,0),Math.PI/2);if(value===6)q.setFromAxisAngle(new T.Vector3(1,0,0),Math.PI);if(value===3)q.setFromAxisAngle(new T.Vector3(0,0,1),Math.PI/2);if(value===4)q.setFromAxisAngle(new T.Vector3(0,0,1),-Math.PI/2);return new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),yaw).multiply(q)}
