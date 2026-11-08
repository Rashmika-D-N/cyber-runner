let model, sampleCanvas, sampleContext;

// Sample the inner shirt, away from the background and the moving arms.
function shirtColour(points, pixels, side) {
  const [left, right, hipL, hipR] = [11, 12, 23, 24].map(i => points[i]);
  if (![left, right, hipL, hipR].every(p => p && p.visibility > 0.5)) return null;
  const channels = [[], [], []];
  for (const across of [0.28, 0.5, 0.72]) {
    for (const down of [0.28, 0.46, 0.64]) {
      const coordinate = key => (left[key] * (1 - across) + right[key] * across) * (1 - down)
        + (hipL[key] * (1 - across) + hipR[key] * across) * down;
      const x = Math.floor(coordinate('x') * side), y = Math.floor(coordinate('y') * side);
      if (x < 0 || y < 0 || x >= side || y >= side) continue;
      const index = (y * side + x) * 4;
      channels.forEach((values, c) => values.push(pixels[index + c]));
    }
  }
  if (channels[0].length < 5) return null;
  return channels.map(values => values.sort((a, b) => a - b)[Math.floor(values.length / 2)] / 255);
}

self.onmessage = async ({data}) => {
  try {
    if (data.type === 'init') {
      const {FilesetResolver, PoseLandmarker} = await import('./vendor/mediapipe/vision_bundle.mjs');
      const files = await FilesetResolver.forVisionTasks(new URL('./vendor/mediapipe/wasm', self.location).href);
      model = await PoseLandmarker.createFromOptions(files, {
        baseOptions: {modelAssetPath: new URL('./vendor/mediapipe/pose_landmarker_full.task', self.location).href},
        runningMode: 'VIDEO', numPoses: 2, minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.45, minTrackingConfidence: 0.45,
      });
      sampleCanvas = new OffscreenCanvas(64, 64);
      sampleContext = sampleCanvas.getContext('2d', {willReadFrequently: true});
      self.postMessage({type: 'ready'});
    } else if (data.type === 'frame') {
      const start = performance.now();
      try {
        const {landmarks} = model.detectForVideo(data.bitmap, data.timestamp);
        let pixels;
        if (landmarks.length && sampleContext) {
          sampleContext.drawImage(data.bitmap, 0, 0, 64, 64);
          pixels = sampleContext.getImageData(0, 0, 64, 64).data;
        }
        const poses = landmarks.map(points => ({points, shirt: pixels ? shirtColour(points, pixels, 64) : null}));
        self.postMessage({type: 'pose', poses, ms: performance.now() - start,
          timestamp: data.timestamp, epoch: data.epoch});
      } finally { data.bitmap.close(); }
    }
  } catch (error) { self.postMessage({type: 'error', message: error.message}); }
};
