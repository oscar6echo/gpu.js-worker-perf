
importScripts(
  "https://cdn.jsdelivr.net/npm/gpu.js@latest/dist/gpu-browser.min.js"
);

const buildComputeMandelbrot = ({
  canvasWidth,
  canvasHeight,
  maxIter,
  graphical
}) => {
  const settings = {
    argumentTypes: {
      rMin: "Float",
      rMax: "Float",
      iMin: "Float",
      iMax: "Float",
      palette: "Array"
    },
    returnType: "Array(4)",
    constants: { canvasWidth, canvasHeight, maxIter },
    output: [canvasWidth, canvasHeight],
    loopMaxIterations: maxIter,
    graphical
  };

  console.log(settings);

  function computeMandelbrot(rMin, rMax, iMin, iMax, palette) {
    const maxIter = this.constants.maxIter;
    const canvasWidth = this.constants.canvasWidth;
    const canvasHeight = this.constants.canvasHeight;

    const cI = iMax + (iMin - iMax) * (this.thread.y / canvasHeight);
    const cR = rMin + (rMax - rMin) * (this.thread.x / canvasWidth);

    let zR = 0;
    let zI = 0;
    let iter = 0;
    let temp = 0;
    while (zR * zR + zI * zI < 4 && iter < maxIter) {
      temp = zR * zR - zI * zI + cR;
      zI = 2 * zR * zI + cI;
      zR = temp;
      iter++;
    }
    if (iter === maxIter) {
      return [0, 0, 0, 255];
    }
    return [
      palette[3 * iter],
      palette[3 * iter + 1],
      palette[3 * iter + 2],
      255
    ];
  }

  function computeMandelbrotCanvas(rMin, rMax, iMin, iMax, palette) {
    const maxIter = this.constants.maxIter;
    const canvasWidth = this.constants.canvasWidth;
    const canvasHeight = this.constants.canvasHeight;

    const cI = iMin + (iMax - iMin) * (this.thread.y / canvasHeight);
    const cR = rMin + (rMax - rMin) * (this.thread.x / canvasWidth);

    let zR = 0;
    let zI = 0;
    let iter = 0;
    let temp = 0;
    while (zR * zR + zI * zI < 4 && iter < maxIter) {
      temp = zR * zR - zI * zI + cR;
      zI = 2 * zR * zI + cI;
      zR = temp;
      iter++;
    }
    if (iter === maxIter) {
      this.color(0, 0, 0, 1);
    } else {
      this.color(
        palette[3 * iter] / 255,
        palette[3 * iter + 1] / 255,
        palette[3 * iter + 2] / 255,
        1
      );
    }
  }

  const gpu = new GPU();
  if (graphical) return gpu.createKernel(computeMandelbrotCanvas, settings);
  else return gpu.createKernel(computeMandelbrot, settings);
};

//////////////////
//////////////////
//////////////////
//////////////////
//////////////////

let activePalette = null;
let activeCanvasWidth = null;
let activeCanvasHeight = null;
let activeMaxIter = null;
let computeGrid = null;

self.onmessage = ({
  data: {
    msgType,
    paletteArr,
    rMin,
    rMax,
    iMin,
    iMax,
    canvasDims,
    maxIter,
    generation
  }
}) => {
  switch (msgType) {
    case "init": {
      activePalette = paletteArr;
      activeMaxIter = maxIter;
      activeCanvasWidth = canvasDims.width;
      activeCanvasHeight = canvasDims.height;

      computeGrid = buildComputeMandelbrot({
        canvasWidth: activeCanvasWidth,
        canvasHeight: activeCanvasHeight,
        maxIter: activeMaxIter,
        graphical: false
      });

      self.postMessage({
        msgType: "init"
      });
      return;
    }

    case "run-grid": {
      if (!activePalette) throw new Error("missing palette");
      if (!computeGrid) throw new Error("computeGrid not built");

      console.time("timer-gpu");
      const result = computeGrid(rMin, rMax, iMin, iMax, activePalette);
      console.timeEnd("timer-gpu");

      const arrImageDataGrid = new Uint8Array(
        4 * canvasDims.width * canvasDims.height
      );

      for (let j = 0; j < canvasDims.height; j++) {
        for (let i = 0; i < canvasDims.width; i++) {
          for (let k = 0; k < 4; k++) {
            arrImageDataGrid[4 * (j * canvasDims.width + i) + k] =
              result[j][i][k];
          }
        }
      }

      self.postMessage({ msgType: "run-grid", generation, arrImageDataGrid }, [
        arrImageDataGrid.buffer
      ]);
    }
  }
};
