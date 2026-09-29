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
    // Real Tokam2D density fluctuations (simulation 151, g = 0.39, kappa = 3.48): 64 snapshots, every 2nd
    // saved frame, on y in [0, 32] x x in [0, 64] (rho_0 units, half of the periodic domain), upsampled x2
    // by Fourier interpolation (exact at the original grid points). Stored as grey levels:
    // value = (grey / 255 - 0.5) * 2 * vmax. Rows run from y = 0 (top of the sprite) to y = 32.
    // The last 12 frames are blended into the frames preceding the first one so the loop has no jump.
    file: 'assets/viz/plasma_sim151.webp', frames: 64, cols: 8, w: 256, h: 128, fps: 14,
    vmax: 27.96, xmax: 64, ymax: 32,
    cmap: ['#5e4fa2', '#3387bc', '#66c2a5', '#aadca4', '#e6f598', '#fffebe', '#fee08b', '#fdad60', '#f46d43', '#d43d4f', '#9e0142'],
  },
};
