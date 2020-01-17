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
  console.time("timer-worker");

  processGrid();
};

const processGrid = () => {
  const canvasDims = {
    width: canvas.width,
    height: canvas.height
  };
  worker.postMessage({
    msgType: "run-grid",
    rMin,
    rMax,
    iMin,
    iMax,
    canvasDims,
    maxIter,
    generation
  });
};

const receiveGrid = data => {
  console.log("START receiveGrid");
  const { generation, arrImageDataGrid } = data;
  console.log("generation:", generation);

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

console.log("CREATE worker");
const worker = new Worker("mandelbrot.worker.js");

worker.onerror = function(evt) {
  worker.idle = true;
  console.log(`Error from Web Worker: ${evt.message}`);
};

worker.onmessage = function(evt) {
  worker.idle = true;

  switch (evt.data.msgType) {
    case "init": {
      console.log("receive INIT");
      startDraw();
      return;
    }
    case "run-grid": {
      console.log("receive RUN-GRID");
      console.timeLog("timer-worker", "receive msg from worker");
      receiveGrid(evt.data);
      console.timeLog("timer-worker", "after receiveGrid");
      startDraw;
      console.timeLog("timer-worker", "after draw");
      console.timeEnd("timer-worker");
      return;
    }
  }
};

console.log("START init msg to worker");

const canvasDims = {
  width: canvas.width,
  height: canvas.height
};
const payload = {
  msgType: "init",
  canvasDims,
  paletteArr: paletteArr,
  maxIter: maxIter
};
worker.postMessage(payload);
