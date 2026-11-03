let model;
self.onmessage=async({data:d})=>{
 try{
  if(d.type==='init'){
   const {FilesetResolver,PoseLandmarker}=await import('./vendor/mediapipe/vision_bundle.mjs');
   const files=await FilesetResolver.forVisionTasks(new URL('./vendor/mediapipe/wasm',self.location).href);
   model=await PoseLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:new URL('./vendor/mediapipe/pose_landmarker_full.task',self.location).href},runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.5,minPosePresenceConfidence:.45,minTrackingConfidence:.45});
   self.postMessage({type:'ready'});
  }else if(d.type==='frame'){
   const start=performance.now();let result;try{result=model.detectForVideo(d.bitmap,d.timestamp);}finally{d.bitmap.close();}
   self.postMessage({type:'pose',points:result.landmarks[0],ms:performance.now()-start,timestamp:d.timestamp,epoch:d.epoch});
  }
 }catch(e){self.postMessage({type:'error',message:e.message});}
};
