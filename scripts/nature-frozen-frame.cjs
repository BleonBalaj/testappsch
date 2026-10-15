// Inlined into the isolated Nature scene by the generator. Copy the actual
// final frame, rather than approximating the meadow or changing any card.
function createNatureFrozenFrame(canvas, renderer, requestDraw) {
  let picture = null, context = null, extension = null;
  let state = 'live', wakeRequested = false, disabled = false;
  let snapshots = 0;
  const restore = () => {
    if (state !== 'parked') return;
    state = 'restoring';
    try { extension.restoreContext(); }
    catch { state = 'parked'; }
  };
  canvas.addEventListener('webglcontextlost', event => {
    if (state !== 'parking') return;
    event.preventDefault();
    // WebGL is not restorable until the loss event has finished dispatching.
    // A phase/resize/resume can already be waiting while this frame parks;
    // keep ready() blocked until a single task after the event, then wake it.
    setTimeout(() => {
      if (state !== 'parking') return;
      state = 'parked';
      if (wakeRequested) restore();
    }, 0);
  });
  canvas.addEventListener('webglcontextrestored', () => {
    state = 'live';
    wakeRequested = false;
    requestDraw();
  });
  return {
    ready() {
      if (state === 'live') return true;
      wakeRequested = true;
      restore();
      return false;
    },
    present(frozen) {
      if (!frozen || disabled) {
        if (canvas.style.display === 'none') canvas.style.display = 'block';
        if (picture && picture.style.display !== 'none') {
          picture.style.display = 'none';
          // Once a complete live frame is shown, release the now-unused
          // bitmap backing store as well. Moving mode adds no style churn.
          picture.width = picture.height = 1;
        }
        return;
      }
      try {
        if (!picture) {
          picture = document.createElement('canvas');
          picture.id = 'nature-frozen-frame';
          picture.setAttribute('aria-hidden', 'true');
          context = picture.getContext('2d', { alpha: false });
          if (!context) throw new Error('No bitmap canvas');
          canvas.after(picture);
          extension = renderer.getContext().getExtension('WEBGL_lose_context');
        }
        // The draw runs immediately after composer.render(), while the WebGL
        // buffer is valid. No encoding, scaling, readPixels or image fetching.
        if (picture.width !== canvas.width) picture.width = canvas.width;
        if (picture.height !== canvas.height) picture.height = canvas.height;
        context.drawImage(canvas, 0, 0);
        picture.style.display = 'block';
        canvas.style.display = 'none';
        snapshots++;
        if (extension) {
          state = 'parking';
          wakeRequested = false;
          extension.loseContext();
        }
      } catch {
        // Older/limited browsers keep the existing native paused renderer.
        disabled = true;
        state = 'live';
        canvas.style.display = 'block';
        if (picture) picture.style.display = 'none';
      }
    },
    inspect() { return { state, snapshots, bitmap: picture?.style.display === 'block' }; },
  };
}
module.exports = { createNatureFrozenFrame };
