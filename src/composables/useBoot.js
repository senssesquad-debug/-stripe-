// Coordinates the first-load veil with the hero: the loader waits for the 3D
// scene (or gives up), and the hero intro waits for the loader to lift.
let resolveScene
let resolveReleased
const sceneReady = new Promise((r) => (resolveScene = r))
const released = new Promise((r) => (resolveReleased = r))

export const boot = {
  sceneReady,
  released,
  markSceneReady: () => resolveScene(),
  release: () => resolveReleased(),
}

// Pages without a 3D scene should not hold the loader.
setTimeout(() => {
  if (!/\/home\/?$/.test(location.pathname)) resolveScene()
}, 0)
