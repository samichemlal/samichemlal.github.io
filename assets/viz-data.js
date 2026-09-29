// Data behind the publication animations, kept apart from the drawing code (assets/viz.js)
// so real results can be plugged in later. Everything in `mtl` and `doodl` is
// illustrative; `plasma` points to real simulation snapshots.
window.VIZ_DATA = {
  mtl: {
    // One Langevin system per task: potential V(x) = a (x^2 - 1)^2 + b x, inverse temperature beta.
    systems: [
      { a: 1.0, b: 0.00, beta: 3.0 },
      { a: 0.7, b: 0.35, beta: 3.0 },
      { a: 1.4, b: -0.3, beta: 3.0 },
    ],
    newSystem: { a: 0.9, b: 0.18, beta: 3.0 },
    // Task matrices (shown as d x d grids of cells, entries in [-1, 1]).
    taskMatrices: [
      [[0.9, 0.2, 0.0, 0.1], [0.1, 0.7, 0.3, 0.0], [0.0, 0.2, 0.5, 0.2], [0.1, 0.0, 0.1, 0.3]],
      [[0.6, 0.4, 0.1, 0.0], [0.2, 0.9, 0.1, 0.2], [0.1, 0.0, 0.3, 0.1], [0.0, 0.3, 0.1, 0.6]],
      [[0.3, 0.0, 0.2, 0.1], [0.0, 0.5, 0.0, 0.4], [0.4, 0.1, 0.9, 0.0], [0.1, 0.2, 0.0, 0.7]],
    ],
    // Transfer matrix M* estimated in closed form for the new system.
    newMatrix: [[0.7, 0.3, 0.1, 0.1], [0.1, 0.8, 0.2, 0.1], [0.2, 0.1, 0.6, 0.1], [0.0, 0.2, 0.1, 0.5]],
    // Conditional density p(y | x) of the new system on a grid: estimate vs reference.
    density: {
      y: [-2, 2],
      reference: { weights: [0.62, 0.38], means: [-0.95, 1.0], sds: [0.34, 0.42] },
      estimate: { weights: [0.6, 0.4], means: [-0.9, 1.04], sds: [0.37, 0.4] },
    },
  },

  doodl: {
    // Dictionary atoms, placed in the surface chart (u, v) in [-1, 1]^2.
    atoms: [[-0.62, -0.42], [0.66, -0.3], [0.02, 0.64]],
    // Coefficients on the simplex: initial guess (from proximity to the atoms) -> estimate.
    alphaInit: [0.4, 0.34, 0.26],
    alphaFinal: [0.57, 0.31, 0.12],
    // Population of operators of related systems.
    cloud: { n: 150, seed: 7, spread: 0.3 },
  },

  plasma: {
    // Real Tokam2D density fluctuations: 48 consecutive snapshots per system (every 4th saved frame),
    // colour-mapped offline (RdBu, symmetric scale per system) into a sprite sheet of 8 x 6 frames.
    frames: 48, cols: 8, size: 128, fps: 10,
    systems: [
      { file: 'assets/viz/plasma_sim86.webp', g: 0.051, kappa: 1.42 },
      { file: 'assets/viz/plasma_sim97.webp', g: 0.257, kappa: 2.31 },
      { file: 'assets/viz/plasma_sim352.webp', g: 0.447, kappa: 3.3 },
    ],
  },
};
