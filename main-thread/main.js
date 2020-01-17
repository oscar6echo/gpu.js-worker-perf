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

//////////
//////////
//////////
//////////
//////////
//////////
//////////

const addListenersToCanvas = canvas => {
  console.log("START addListenersToCanvas");

  const _listenerClick = evt => {
    zoomIn = !!evt.shiftKey;
    clickCanvas(evt);
  };
  canvas.addEventListener("click", _listenerClick);
};

const clickCanvas = evt => {
  console.log("START clickCanvas");

  const { posFractal } = getPoint(evt);
  console.log(posFractal);

  centerRe = posFractal.x;
  centerIm = posFractal.y;

  const factor = zoomIn ? 1.0 / zoomFactor : zoomFactor;
  zoom *= factor;

  buildBounds();
  startDraw();
};

const getPoint = evt => {
  const rect = canvas.getBoundingClientRect();
  const posPixel = {
    x: evt.clientX - rect.left - canvas.clientLeft,
    y: evt.clientY - rect.top - canvas.clientTop
  };
  const posPct = {
    x: posPixel.x / rect.width,
    y: posPixel.y / rect.height
  };
  const fractalWidth = rMax - rMin;
  const fractalHeight = iMax - iMin;

  const posFractal = {
    x: rMin + fractalWidth * posPct.x,
    y: iMax - fractalHeight * posPct.y
  };
  return { rect, posPixel, posPct, posFractal };
};

const buildBounds = () => {
  console.log("START buildBounds");

  const newWidth = fractalWidthInit / zoom;
  const newHeight = newWidth * (canvas.height / canvas.width);

  rMin = centerRe - newWidth / 2;
  rMax = centerRe + newWidth / 2;
  iMin = centerIm - newHeight / 2;
  iMax = centerIm + newHeight / 2;

  console.log({
    zoom,
    newWidth,
    newHeight,
    canvasWidth: canvas.width,
    canvasHeight: canvas.height
  });
  console.log({
    rMin,
    rMax,
    iMin,
    iMax
  });
};

const buildPalette = ({ freqRed, freqBlue, freqGreen, maxIter }) => {
  const palette = [];
  const wrap = x => {
    const remainder = x % 255;
    const quotient = (x - remainder) / 255;
    if (quotient % 2 === 0) return remainder;
    return 255 - remainder;
  };
  for (let i = 0; i <= maxIter; i++) {
    palette.push({
      red: wrap(freqRed * i),
      green: wrap(freqGreen * i),
      blue: wrap(freqBlue * i)
    });
  }
  return palette;
};

const buildPaletteArray = palette => {
  const paletteArr = new Uint8Array(3 * palette.length);
  for (const [i, color] of Object.entries(palette)) {
    paletteArr[3 * i] = color.red;
    paletteArr[3 * i + 1] = color.green;
    paletteArr[3 * i + 2] = color.blue;
  }
  return paletteArr;
};

const startDraw = () => {
  console.log("START startDraw");

  generation++;
  console.time("timer-gpu");

  const arrImageDataGrid = processGrid2();
  receiveGrid2(arrImageDataGrid);
};

const processGrid2 = () => {
  const canvasDims = {
    width: canvas.width,
    height: canvas.height
  };
  const result = computeGrid(rMin, rMax, iMin, iMax, paletteArr);
  console.timeLog("timer-gpu", "after computeGrid");

  const arrImageDataGrid = new Uint8Array(
    4 * canvasDims.width * canvasDims.height
  );

  for (let j = 0; j < canvasDims.height; j++) {
    for (let i = 0; i < canvasDims.width; i++) {
      for (let k = 0; k < 4; k++) {
        arrImageDataGrid[4 * (j * canvasDims.width + i) + k] = result[j][i][k];
      }
    }
  }

  console.timeEnd("timer-gpu", "after arrImageDataGrid ");
  return arrImageDataGrid;
};

const receiveGrid2 = arrImageDataGrid => {
  console.log("START receiveGrid2");

  gridData.data.set(arrImageDataGrid, 0);
  ctx.putImageData(gridData, 0, 0);
};

////////
////////
////////
////////
////////

console.log("START");
const canvas = document.getElementById("my-canvas");
canvas.width = 900;
canvas.height = 500;
const ctx = canvas.getContext("2d");
const gridData = ctx.createImageData(canvas.width, canvas.height);
let posFractal = {};
let liveDebug = {};

const freqRed = 5;
const freqGreen = 7;
const freqBlue = 11;

const zoomFactor = 2;
const fractalWidthInit = 4;
let zoomIn = true;
let centerRe = -0.5;
let centerIm = 0;
let zoom = 1;
let maxIter = 1024;
let rMin, rMax, iMin, iMax;
let generation = 0;

let timerStart = 0;
let timerEnd = 0;

const palette = buildPalette({ freqRed, freqGreen, freqBlue, maxIter });
const paletteArr = buildPaletteArray(palette);
buildBounds();
addListenersToCanvas(canvas);

console.log({ palette, paletteArr });

console.log("CREATE gpu kernel");

const computeGrid = buildComputeMandelbrot({
  canvasWidth: canvas.width,
  canvasHeight: canvas.height,
  maxIter: maxIter,
  graphical: false
});

startDraw()

