import renderImageFromUrl, {renderImageFromUrlPromise} from '../../helpers/dom/renderImageFromUrl';
import apiManagerProxy from '../../lib/mtproto/mtprotoworker';
import {createEffect, createSignal} from 'solid-js'
import {EditEvent, EnhanceEvent, EnhanceFilters} from './panel';
import Icon from '../icon';
import windowSize from '../../helpers/windowSize';

// const Editor = (params :{
//   file: File
// }) => {
//   let canvas: HTMLCanvasElement;


//   createEffect(async() => {
//     // create image from file
//     const img = new Image();
//     const url = await apiManagerProxy.invoke('createObjectURL', params.file);
//     await renderImageFromUrlPromise(img, url);

//     // draw image on canvas
//     canvas.width = img.width;
//     canvas.height = img.height;
//     const ctx = canvas.getContext('2d');
//     ctx.drawImage(img, 0, 0);
//   });

//   return <>
//     <canvas ref={canvas}></canvas>
//   </>
// };

type PropertiesType = {
  enhance: {
    canvas?: HTMLCanvasElement;
    needsRender: boolean,
    renderTimeout: number,
    values: {
      [key in EnhanceEvent['filter']]: number;
    };
  },
  crop: {
    canvas?: HTMLCanvasElement;
    panel: HTMLDivElement,
    activeCorner: null | 'rt' | 'lt' | 'lb' | 'rb' | 'center',
    mouseDownPos: {
      x: number;
      y: number;
    } | null,
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    realRotation: number;
    bufferRotation: number;
    mirror: number;
    degreeMarksContainer: HTMLDivElement | null;
    bufferMirror: number;
    panelElements: HTMLElement[];
    panelRotationTicks: number;
    realMirror: number;
    rotationAnimationInProgress: boolean,
    mirrorAnimationInProgress: boolean,
    enabled: boolean,
    onFreeCallback: () => void,
    ratio: {
      type: 'free' | 'original';
    } | {
      type: 'custom';
      x: number;
      y: number;
    }
  }
};

class Editor {
  public canvas: HTMLCanvasElement;
  public itemDiv: HTMLElement;
  public refreshIntervalId: ReturnType<typeof setInterval>;

  private sourceImage: HTMLImageElement;
  private canvasContainer: HTMLDivElement;
  private saveEvent: (event: EditEvent) => void;
  static imagePadding: number = 16;

  private properties: PropertiesType = {
    enhance: {
      values: {} as any,
      renderTimeout: 100,
      needsRender: false
    },
    crop: {
      panel: document.createElement('div'),
      activeCorner: null,
      mouseDownPos: null,
      onFreeCallback: () => {},
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      rotation: 0,
      rotationAnimationInProgress: false,
      panelElements: [],
      degreeMarksContainer: null,
      panelRotationTicks: 0,
      mirror: 1,
      bufferMirror: 0,
      realMirror: 1,
      realRotation: 0,
      bufferRotation: 0,
      mirrorAnimationInProgress: false,
      enabled: false,
      ratio: {
        type: 'free'
      }
    }
  };

  constructor(file: File, renderElement: HTMLElement) {
    this.itemDiv = document.createElement('div');
    this.itemDiv.classList.add('editor-container');

    this.canvasContainer = document.createElement('div');
    this.canvasContainer.classList.add('canvas-container');

    this.itemDiv.append(this.canvasContainer);

    this.canvas = document.createElement('canvas');
    this.canvasContainer.append(this.canvas);

    // init pipeline values
    const createCropPanel = () => {
      const cropPanel = this.properties.crop.panel;
      cropPanel.classList.add('crop-panel');
      this.itemDiv.append(cropPanel);

      const flipIcon = document.createElement('div');
      flipIcon.append(Icon('cropflip'));
      flipIcon.classList.add('icon-button');
      flipIcon.onclick = this.cropFlip.bind(this);

      const rotateIcon = document.createElement('div');
      rotateIcon.append(Icon('croprotate'));
      rotateIcon.classList.add('icon-button');
      rotateIcon.onclick = this.cropRotate.bind(this);


      // degree scale creation
      const degreeScale = document.createElement('div');
      degreeScale.classList.add('degree-scale');
      cropPanel.append(rotateIcon, degreeScale, flipIcon);

      degreeScale.addEventListener('wheel', (e: WheelEvent) => {
        const sign = Math.sign(e.deltaY);
        this.rotateCropPanel(sign);
      });

      const cursorIcon = Icon('cursor');
      const cursor = document.createElement('div');
      cursor.classList.add('cursor');
      cursor.append(cursorIcon);
      degreeScale.append(cursor);

      const degreeMarksContainer = document.createElement('div');
      this.properties.crop.degreeMarksContainer = degreeMarksContainer;
      degreeMarksContainer.classList.add('degree-marks-container');
      degreeScale.append(degreeMarksContainer);

      const marksCount = 12;
      const marksStep = 6;
      const markGap = 4;

      const mainMarksList: HTMLElement[] = [];
      const subMarksList = []

      for(let i = -marksCount; i < marksCount + 1; i++) {
        const markContainer = document.createElement('div');
        markContainer.classList.add('degree-mark-container');

        const mark = document.createElement('div');
        mark.classList.add('degree-mark');
        markContainer.append(mark);
        degreeMarksContainer.append(markContainer);
        this.properties.crop.panelElements.push(markContainer);
        markContainer.style.left = `${i * (2 * marksStep + markGap * (marksStep + 1)) + i * 2 - 1}px`;
        mainMarksList.push(markContainer);

        if(i == marksCount) {
          continue;
        }

        // submarks
        for(let j = 0; j < marksStep; j++) {
          const subMarkContainer = document.createElement('div');
          subMarkContainer.classList.add('degree-mark-container');

          const submark = document.createElement('div');
          submark.classList.add('degree-mark');
          subMarkContainer.append(submark);
          degreeMarksContainer.append(subMarkContainer);
          this.properties.crop.panelElements.push(subMarkContainer);
          const markContainerLeft = i * (2 * marksStep + markGap * (marksStep + 1)) + i * 2 - 1;
          subMarkContainer.style.left = `${markContainerLeft + (j + 1) * markGap + (j + 1) * 2}px`;
          submark.style.backgroundColor = 'grey';
          subMarksList.push(subMarkContainer);
        }
      }


      function getTextWidth(input: string): number {
        const text = document.createElement('span');
        document.body.appendChild(text);

        text.style.fontSize = 12 + 'px';
        text.style.height = 'auto';
        text.style.width = 'auto';
        text.style.position = 'absolute';
        text.style.whiteSpace = 'no-wrap';
        text.style.fontWeight = '500';
        text.innerHTML = input;

        const width = Math.ceil(text.clientWidth);
        const formattedWidth = width;

        document.body.removeChild(text);
        return formattedWidth;
      }

      const minusWidth = getTextWidth('-');

      // numbers
      for(let i = 0; i < mainMarksList.length; ++i) {
        const degreeNumberContainer = document.createElement('div');
        degreeNumberContainer.classList.add('degree-number-container');

        const degreeNumber = document.createElement('div');
        degreeNumber.classList.add('degree-number');
        degreeNumber.textContent = `${15 * (i - marksCount)}°`;

        degreeNumberContainer.append(degreeNumber);
        degreeMarksContainer.append(degreeNumberContainer);

        this.properties.crop.panelElements.push(degreeNumberContainer);

        let textContentToCalc = degreeNumber.textContent.slice(0, -1);
        let additionalWidth = 0;
        if(textContentToCalc[0] == '-') {
          textContentToCalc = textContentToCalc.slice(1);
          additionalWidth = minusWidth;
        }
        const textWidth = getTextWidth(textContentToCalc);

        degreeNumberContainer.style.left = `${parseInt(mainMarksList[i].style.left.slice(0, -2)) - textWidth / 2 - additionalWidth}px`;
      }
    }
    createCropPanel();
    this.updateCropPanel();

    for(const filter of EnhanceFilters) {
      this.properties.enhance.values[filter] = 0;
    }


    renderElement.replaceWith(this.itemDiv);

    createEffect(async() => {
      this.sourceImage = new Image();
      const url = await apiManagerProxy.invoke('createObjectURL', file);
      await renderImageFromUrlPromise(this.sourceImage, url);

      // set size for result canvas
      const ctx = this.canvas.getContext('2d');
      this.canvas.width = this.sourceImage.width;
      this.canvas.height = this.sourceImage.height;

      // init all pipeline canvases and other props
      for(const layer of Object.keys(this.properties) as Array<keyof PropertiesType>) {
        const canvas = this.properties[layer].canvas = document.createElement('canvas');
        canvas.width = this.canvas.width;
        canvas.height = this.canvas.height;
      }

      this.properties.crop.width = this.sourceImage.width;
      this.properties.crop.height= this.sourceImage.height;

      // set timeout limitation for redrawing
      this.refreshIntervalId = setInterval((() => {
        if(this.properties.enhance.needsRender) {
          this.doEnhance();
          this.properties.enhance.needsRender = false;
        }
      }).bind(this), this.properties.enhance.renderTimeout);

      this.doEnhance();
      this.enableCropMode();
      this.disableCropMode();
    });
  }

  public setSaveEvent(saveEvent: (e: EditEvent) => void) {
    this.saveEvent = saveEvent;
  }

  private rotateCropPanel(ticks: number) {
    const props = this.properties.crop;
    const oldTicks = props.panelRotationTicks;

    props.panelRotationTicks += ticks;
    props.panelRotationTicks = Math.max(-84, Math.min(84, props.panelRotationTicks));

    if(oldTicks == props.panelRotationTicks) {
      return;
    }

    const rotation = Math.PI / 84 * ticks;
    props.bufferRotation += rotation;
    props.realRotation += rotation;
    if(!props.rotationAnimationInProgress) {
      this.cropRotateBuffer();
    }
    this.updateCropPanel();
  }

  private updateCropPanel() {
    const props = this.properties.crop;

    props.degreeMarksContainer.style.left = `${props.panelRotationTicks * 6}px`;

    for(const element of props.panelElements) {
      const left = parseInt(element.style.left.slice(0, -2)) + 6 * props.panelRotationTicks + 1;

      const opacity = Math.max(0, (1 - Math.abs(left / 200)));
      element.style.opacity = `${opacity}`;


      // increase font size for cursor element

      if(element.classList.contains('degree-number-container')) {
        // if(Math.abs(left) < 400) {
        const k = 1 - Math.abs(left) / 1000;
        element.style.fontSize = `${12 + 4 * k}px`;
        element.style.top = `-${5 * k}px`;
      }
    }
  }

  public processEvent(e: EditEvent) {
    switch(e.type) {
      case 'enhance':
        this.properties.enhance.values[e.filter] = e.value;
        this.properties.enhance.needsRender = true;
        break;
      case 'crop':
        if(e.data == 'original' || e.data == 'free') {
          this.properties.crop.ratio.type = e.data;
        } else {
          const [stringX, stringY] = e.data.split('_');
          const [x, y] = [parseInt(stringX), parseInt(stringY)];
          this.properties.crop.ratio = {
            type: 'custom',
            x,
            y
          };
        }
        this.processCropEvent();
    }
  }

  private processCropEvent() {
    const props = this.properties.crop;
    if(props.ratio.type == 'original') {
      this.properties.crop.x = 0;
      this.properties.crop.y = 0;
      this.properties.crop.width = this.canvas.width - 2 * Editor.imagePadding;
      this.properties.crop.height = this.canvas.height - 2 * Editor.imagePadding;
    } else if(props.ratio.type == 'custom') {
      props.x = 0;
      props.y = 0
      if(props.ratio.x / props.ratio.y <= this.sourceImage.width / this.sourceImage.height) {
        props.width = Math.floor(props.ratio.x / props.ratio.y * this.sourceImage.height);
        props.height = this.sourceImage.height;
      } else {
        props.height = Math.floor(props.ratio.y / props.ratio.x * this.sourceImage.width);
        props.width = this.sourceImage.width;
      }
    }

    this.doCrop();
    this.doCrop();
  }

  // pipeline functions (in their order)
  private doEnhance() {
    const ctx = this.properties.enhance.canvas.getContext('2d', {willReadFrequently: true});
    const [width, height] = [this.sourceImage.width, this.sourceImage.height];
    ctx.drawImage(this.sourceImage, 0, 0);

    const values = this.properties.enhance.values;

    const enhance = () => {
      const enhanceValue = values.Enhance / 4;

      // Calculate the adjustment factors
      const contrast = 1 + (enhanceValue / 100); // Increase contrast
      const brightness = enhanceValue / 100 * 30; // Increase brightness
      const saturation = 1 + (enhanceValue / 100); // Increase saturation

      // Get image data
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      // Iterate over each pixel
      for(let i = 0; i < data.length; i += 4) {
        // Get RGB values
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];

        // Apply brightness
        r += brightness;
        g += brightness;
        b += brightness;

        // Apply contrast
        r = ((r - 128) * contrast) + 128;
        g = ((g - 128) * contrast) + 128;
        b = ((b - 128) * contrast) + 128;

        // Apply saturation
        const avg = 0.299 * r + 0.587 * g + 0.114 * b;
        r = avg + (r - avg) * saturation;
        g = avg + (g - avg) * saturation;
        b = avg + (b - avg) * saturation;

        // Set new RGB values
        data[i] = Math.max(0, Math.min(255, r));
        data[i + 1] = Math.max(0, Math.min(255, g));
        data[i + 2] = Math.max(0, Math.min(255, b));
      }

      // Put image data back onto the canvas
      ctx.putImageData(imageData, 0, 0);
    }

    const brightness = () => {
      ctx.filter = `brightness(${values.Brightness + 100}%)`;
    }

    const contrast = () => {
      const imgData = ctx.getImageData(0, 0, width, height);
      const d = imgData.data;
      const value = (values.Contrast/100) + 1;
      var intercept = 128 * (1 - value);
      for(var i = 0; i < d.length; i += 4) {
        d[i] = d[i]*value + intercept;
        d[i+1] = d[i+1]*value + intercept;
        d[i+2] = d[i+2]*value + intercept;
      }
      ctx.putImageData(imgData, 0, 0);
    }

    const saturation = () => {
      const imageData = ctx.getImageData(0, 0, width, height);
      const dA = imageData.data; // raw pixel data in array

      const sv = values.Saturation / 100 + 1; // saturation value. 0 = grayscale, 1 = original

      const luR = 0.3086; // constant to determine luminance of red. Similarly, for green and blue
      const luG = 0.6094;
      const luB = 0.0820;

      const az = (1 - sv)*luR + sv;
      const bz = (1 - sv)*luG;
      const cz = (1 - sv)*luB;
      const dz = (1 - sv)*luR;
      const ez = (1 - sv)*luG + sv;
      const fz = (1 - sv)*luB;
      const gz = (1 - sv)*luR;
      const hz = (1 - sv)*luG;
      const iz = (1 - sv)*luB + sv;

      for(var i = 0; i < dA.length; i += 4) {
        const red = dA[i]; // Extract original red color [0 to 255]. Similarly for green and blue below
        const green = dA[i + 1];
        const blue = dA[i + 2];

        const saturatedRed = (az*red + bz*green + cz*blue);
        const saturatedGreen = (dz*red + ez*green + fz*blue);
        const saturateddBlue = (gz*red + hz*green + iz*blue);

        dA[i] = saturatedRed;
        dA[i + 1] = saturatedGreen;
        dA[i + 2] = saturateddBlue;
      }
      ctx.putImageData(imageData, 0, 0);
    }

    const warmth = () => {
      const imgData = ctx.getImageData(0, 0, width, height);
      const d = imgData.data;
      const value = -values.Warmth / 5;
      for(var i = 0; i < d.length; i += 4) {
        d[i] = Math.min(255, Math.max(0, d[i] - value));
        d[i+2] = Math.min(255, Math.max(0, d[i + 2] + value));
      }
      ctx.putImageData(imgData, 0, 0);
    }

    const fade = () => {
      ctx.rect(0, 0, width, height);
      const value = values.Fade / 300;
      ctx.fillStyle = `rgba(255, 255, 255, ${value})`;
      ctx.fill();
    }

    const highlightsAndShadows = () => {
      const imgData = ctx.getImageData(0, 0, width, height);
      const d = imgData.data;
      const highlights = values.Highlights / 500;
      const shadows = -values.Shadows / 500;


      const lumR = 0.00299;
      const lumG = 0.00587;
      const lumB = 0.00114;
      for(var i = 0; i < d.length; i += 4) {
        const luminance = lumR*d[i] + lumG*d[i+1] + lumB*d[i+2];
        // console.log(luminance);
        const h = highlights * (Math.pow(10.0, luminance) - 1.0);
        const s = shadows * 10 * (Math.pow(10.0, 1.2 - luminance) - 1.0);
        d[i] += h + s;
        d[i+1] += h + s;
        d[i+2] += h + s;
      }
      ctx.putImageData(imgData, 0, 0);
    }

    const vingette = () => {
      var outerRadius = width * .6;
      var innerRadius = width * .05;
      var grd = ctx.createRadialGradient(width / 2, height / 2, innerRadius, width / 2, height / 2, outerRadius);
      // light blue
      grd.addColorStop(0, 'rgba(0,0,0,0)');
      // dark blue
      grd.addColorStop(1, 'rgba(0,0,0,' + values.Vingette / 150 + ')');

      ctx.fillStyle = grd;
      ctx.fill();
    }

    const grain = () => {
      const imgData = ctx.getImageData(0, 0, width, height);
      const d = imgData.data;
      const amount = values.Grain / 5;

      for(var i = 0; i < d.length; i += 4) {
        const grainAmount = (1 - Math.random() * 2) * amount;
        d[i] += grainAmount;
        d[i+1] += grainAmount;
        d[i+2] += grainAmount;
      }
      ctx.putImageData(imgData, 0, 0);
    }

    const sharpen = () => {
      const h = height;
      const w = width;
      const mix = values.Sharpen / 50;
      var x, sx, sy, r, g, b, a, dstOff, srcOff, wt, cx, cy, scy, scx,
        weights = [0, -1, 0, -1, 5, -1, 0, -1, 0],
        katet = Math.round(Math.sqrt(weights.length)),
        half = (katet * 0.5) | 0,
        dstData = ctx.createImageData(w, h),
        dstBuff = dstData.data,
        srcBuff = ctx.getImageData(0, 0, w, h).data,
        y = h;

      while(y--) {
        x = w;
        while(x--) {
          sy = y;
          sx = x;
          dstOff = (y * w + x) * 4;
          r = 0;
          g = 0;
          b = 0;
          a = 0;

          for(cy = 0; cy < katet; cy++) {
            for(cx = 0; cx < katet; cx++) {
              scy = sy + cy - half;
              scx = sx + cx - half;

              if(scy >= 0 && scy < h && scx >= 0 && scx < w) {
                srcOff = (scy * w + scx) * 4;
                wt = weights[cy * katet + cx];

                r += srcBuff[srcOff] * wt;
                g += srcBuff[srcOff + 1] * wt;
                b += srcBuff[srcOff + 2] * wt;
                a += srcBuff[srcOff + 3] * wt;
              }
            }
          }
          dstBuff[dstOff] = r * mix + srcBuff[dstOff] * (1 - mix);
          dstBuff[dstOff + 1] = g * mix + srcBuff[dstOff + 1] * (1 - mix);
          dstBuff[dstOff + 2] = b * mix + srcBuff[dstOff + 2] * (1 - mix);
          dstBuff[dstOff + 3] = srcBuff[dstOff + 3];
        }
      }

      ctx.putImageData(dstData, 0, 0);
    }

    // apply all effects in specific order
    enhance();
    contrast();
    brightness();
    saturation();
    warmth();
    highlightsAndShadows();
    fade();
    vingette();
    sharpen();
    grain();

    // next pipeline state
    this.doCrop();
  }

  private doCrop() {
    // final pipeline state
    const mainCtx = this.canvas.getContext('2d');
    const ctx = this.properties.crop.canvas.getContext('2d');

    // clear main and crop canvases
    mainCtx.save();
    mainCtx.setTransform(1, 0, 0, 1, 0, 0);
    mainCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    mainCtx.restore();

    ctx.save()
    ctx.setTransform(1, 0, 0, 1, -Editor.imagePadding, -Editor.imagePadding);
    ctx.clearRect(0, 0, ctx.canvas.width * 2, ctx.canvas.height * 2);
    ctx.clearRect(0, 0, ctx.canvas.width * 2, ctx.canvas.height * 2);
    ctx.restore();

    const rotationCanvas = document.createElement('canvas');
    rotationCanvas.width = ctx.canvas.width;
    rotationCanvas.height = ctx.canvas.height;
    const rotationCtx = rotationCanvas.getContext('2d');
    const props = this.properties.crop;

    const xAX = Math.cos(props.rotation);
    const xAY = Math.sin(props.rotation);
    rotationCtx.setTransform(xAX * props.mirror, xAY * props.mirror, -xAY, xAX, this.properties.crop.canvas.width / 2 - Editor.imagePadding, this.properties.crop.canvas.height / 2 - Editor.imagePadding);
    rotationCtx.drawImage(this.properties.enhance.canvas, -this.properties.enhance.canvas.width / 2, -this.properties.enhance.canvas.height / 2);


    if(this.properties.crop.enabled) {
      ctx.drawImage(rotationCanvas, 0, 0);
      this.drawCropInterface();
    } else {
      ctx.drawImage(rotationCanvas, 0, 0);
    }

    mainCtx.drawImage(ctx.canvas, -Editor.imagePadding, -Editor.imagePadding);

    rotationCanvas.remove();
  }

  public async getModifiedFile(newFileName: string): Promise<File> {
    this.disableCropMode();

    return fetch(this.canvas.toDataURL())
    .then(res => res.blob())
    .then(blob => {
      const file = new File([blob], newFileName, blob);
      return file;
    });
  }

  public linkCropFreeCallback(callback: () => void) {
    this.properties.crop.onFreeCallback = callback;
  }

  private drawCropInterface() {
    const props = this.properties.crop;

    const ctx = props.canvas.getContext('2d');

    let [cropX, cropY, cropWidth, cropHeight] = [props.x, props.y, props.width, props.height];

    if(cropWidth < 0) {
      cropWidth = -cropWidth;
      cropX -= cropWidth;
    }
    if(cropHeight < 0) {
      cropHeight = -cropHeight;
      cropY -= cropHeight;
    }

    const rect = this.canvas.getBoundingClientRect();
    const k = this.canvas.width / rect.width;

    const drawPoint = (x: number, y: number) => {
      ctx.beginPath();
      ctx.arc(x, y, 4 * Math.sqrt(k), 0, Math.PI * 2);
      ctx.fillStyle = 'white';
      ctx.fill();
    }

    const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.closePath();

      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.stroke();
    }
    // draw points and lines

    // draw dimmed rects
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, props.canvas.width, cropY);
    ctx.fillRect(0, cropY + cropHeight, props.canvas.width, props.canvas.height);
    ctx.fillRect(0, cropY, cropX, cropHeight);
    ctx.fillRect(cropX + cropWidth, cropY, props.canvas.width - cropX - cropWidth, cropHeight);

    ctx.fill();

    const dh = cropHeight / 3;
    const dw = cropWidth / 3;
    drawLine(cropX, cropY, cropX + cropWidth, cropY);
    drawLine(cropX + 1, cropY + dh, cropX + cropWidth - 1, cropY + dh);
    drawLine(cropX + 1, cropY + dh * 2, cropX + cropWidth - 1, cropY + dh * 2);

    drawLine(cropX, cropY, cropX, cropY + cropHeight);
    drawLine(cropX + dw, cropY + 1, cropX + dw, cropY + cropHeight - 1);
    drawLine(cropX + dw * 2, cropY + 1, cropX + dw * 2, cropY + cropHeight - 1);


    drawLine(cropX + cropWidth, cropY, cropX + cropWidth, cropY + cropHeight);
    drawLine(cropX, cropY + cropHeight, cropX + cropWidth, cropY + cropHeight);

    drawPoint(cropX, cropY);
    drawPoint(cropX + cropWidth, cropY);
    drawPoint(cropX, cropY + cropHeight);
    drawPoint(cropX + cropWidth, cropY + cropHeight);
  }

  private cropCanvasMouseMove(e: MouseEvent) {
    const props = this.properties.crop;

    if(props.activeCorner == null) {
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    const relX = e.clientX - rect.left, relY =  e.clientY - rect.top;
    let x = Math.floor(relX * this.canvas.width / rect.width - Editor.imagePadding);
    let y = Math.floor(relY * this.canvas.height / rect.height - Editor.imagePadding);

    x = Math.max(0, Math.min(x, this.canvas.width - 2 * Editor.imagePadding));
    y = Math.max(0, Math.min(y, this.canvas.height - 2 * Editor.imagePadding));

    let [newX, newY, newWidth, newHeight] = [props.x, props.y, props.width, props.height];

    if(props.activeCorner != 'center' && props.ratio.type == 'original') {
      props.onFreeCallback();
    }

    if(props.activeCorner == 'lb') {
      newWidth = props.width + props.x - x;
      newHeight = y - props.y;
      if(props.ratio.type == 'custom') {
        if(props.ratio.x / props.ratio.y <= newWidth / newHeight) {
          newWidth = Math.floor(props.ratio.x / props.ratio.y * newHeight);
        } else {
          newHeight = Math.floor(props.ratio.y / props.ratio.x * newWidth);
        }
      }
      newX = props.width + props.x - newWidth;
    } else if(props.activeCorner == 'lt') {
      newWidth = props.width - x + props.x;
      newHeight = props.height - y + props.y;

      if(props.ratio.type == 'custom') {
        if(props.ratio.x / props.ratio.y <= newWidth / newHeight) {
          newWidth = Math.floor(props.ratio.x / props.ratio.y * newHeight);
        } else {
          newHeight = Math.floor(props.ratio.y / props.ratio.x * newWidth);
        }
      }

      newX = props.width + props.x - newWidth;
      newY = props.height + props.y - newHeight;
    } else if(props.activeCorner == 'rb') {
      newWidth = x - props.x;
      newHeight = y - props.y;

      if(props.ratio.type == 'custom') {
        if(props.ratio.x / props.ratio.y <= newWidth / newHeight) {
          newWidth = Math.floor(props.ratio.x / props.ratio.y * newHeight);
        } else {
          newHeight = Math.floor(props.ratio.y / props.ratio.x * newWidth);
        }
      }
    } else if(props.activeCorner == 'rt') {
      newY = y;
      newWidth = x - props.x;
      newHeight -= y - props.y;

      newWidth = x - props.x;
      newHeight = props.height + props.y - y;
      if(props.ratio.type == 'custom') {
        if(props.ratio.x / props.ratio.y <= newWidth / newHeight) {
          newWidth = Math.floor(props.ratio.x / props.ratio.y * newHeight);
        } else {
          newHeight = Math.floor(props.ratio.y / props.ratio.x * newWidth);
        }
      }
      newY = props.height + props.y - newHeight;
    } else if(props.activeCorner == 'center') {
      if(props.mouseDownPos == null) {
        return;
      }
      const dx = x - props.mouseDownPos.x;
      const dy = y - props.mouseDownPos.y;
      newX += dx;
      newY += dy;
      newX = Math.max(0, Math.min(newX, this.canvas.width - Editor.imagePadding));
      newY = Math.max(0, Math.min(newY, this.canvas.height - Editor.imagePadding));

      if(newX + newWidth > this.canvas.width - 2 * Editor.imagePadding) {
        newX = this.canvas.width - 2 * Editor.imagePadding - newWidth;
      }
      if(newY + newHeight > this.canvas.height - 2 * Editor.imagePadding) {
        newY = this.canvas.height - 2 * Editor.imagePadding - newHeight;
      }

      if(newX + newWidth < 0) {
        newX = -newWidth;
      }
      if(newY + newHeight < 0) {
        newY = -newHeight;
      }

      props.mouseDownPos = {x: x, y: y};
    }

    if(newX + newWidth > this.canvas.width - 2 * Editor.imagePadding) {
      newWidth = this.canvas.width - 2 * Editor.imagePadding - newX;
    }
    if(newY + newHeight > this.canvas.height - 2 * Editor.imagePadding) {
      newHeight = this.canvas.height - 2 * Editor.imagePadding - newY;
    }


    // if(newWidth <= 1) {
    //   newWidth = 1;
    //   const translate = {
    //     rt: 'lt',
    //     lt: 'rt',
    //     lb: 'rb',
    //     rb: 'lb',
    //     center: 'center'
    //   } as const;

    //   props.activeCorner = translate[props.activeCorner];
    // }

    // if(newHeight < 0) {
    //   newHeight = 1;
    //   const translate = {
    //     rt: 'rb',
    //     rb: 'rt',
    //     lt: 'lb',
    //     lb: 'lt',
    //     center: 'center'
    //   } as const;

    //   // switch(props.activeCorner) {
    //   //   case 'rt':
    //   //     props.activeCorner = 'rb';
    //   //     newY += newHeight;
    //   //     break;
    //   //   case 'rb':
    //   //     break;
    //   //   case 'lt':
    //   //     break;
    //   //   case 'lb':
    //   //     break;
    //   // }
    //   props.activeCorner = translate[props.activeCorner];
    // }

    // console.log(newWidth, newHeight, newX, newY);

    props.width = newWidth;
    props.height = newHeight;
    props.x = newX;
    props.y = newY;

    this.doCrop();
  }

  private cropCanvasMouseDown(e: MouseEvent) {
    const props = this.properties.crop;
    const intersectRadius = 12;
    if(props.activeCorner != null) {
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    const relX = e.clientX - rect.left, relY =  e.clientY - rect.top;
    const x = relX * this.canvas.width / rect.width - Editor.imagePadding;
    const y = relY * this.canvas.height / rect.height - Editor.imagePadding;

    const intersect = (x1: number, y1: number) => {
      if(((x1 - x) ** 2 + (y1 - y) ** 2) < intersectRadius ** 2) {
        return true;
      }
      return false;
    }

    if(intersect(props.x, props.y)) {
      props.activeCorner = 'lt';
    } else if(intersect(props.x + props.width, props.y)) {
      props.activeCorner = 'rt';
    } else if(intersect(props.x, props.y + props.height)) {
      props.activeCorner = 'lb';
    } else if(intersect(props.x + props.width, props.y + props.height)) {
      props.activeCorner = 'rb';
    }

    // center
    if(
      (x > props.x + 5 && x < props.x + props.width - 5 && y > props.y + 5 && y < props.y + props.height - 5) ||
      (x < props.x - 5 && x > props.x + props.width + 5 && y < props.y + 5 && y > props.y + props.height - 5)
    ) {
      props.activeCorner = 'center';
      props.mouseDownPos = {
        x: Math.floor(x),
        y: Math.floor(y)
      };
    }
  }

  private cropCanvasMouseUp(e: Event) {
    const props = this.properties.crop;
    props.activeCorner = null;
  }

  private cropRotateBuffer() {
    let prevTimeStamp: number = undefined
    const props = this.properties.crop;
    props.rotationAnimationInProgress = true;

    const animate = (timeStamp: number) => {
      if(prevTimeStamp === undefined) {
        prevTimeStamp = timeStamp;
      }

      const elapsed = timeStamp - prevTimeStamp;
      if(elapsed === 0) {
        return window.requestAnimationFrame(animate);
      }

      if(Math.abs(props.bufferRotation) < 0.005) {
        props.rotation = props.realRotation;
        props.bufferRotation = 0;
        props.rotationAnimationInProgress = false;
        this.properties.crop.ratio.type = 'original';
        this.processCropEvent();
        this.enableCropMode();
        this.doCrop();
        return;
      }

      let dr = props.bufferRotation * elapsed * 0.01;
      if(Math.abs(dr) > Math.abs(props.bufferRotation)) {
        dr = props.bufferRotation;
      }
      props.bufferRotation -= dr;
      props.rotation += dr;
      this.enableCropMode();
      this.properties.crop.ratio.type = 'original';
      this.processCropEvent();

      prevTimeStamp = timeStamp;
      this.doCrop();
      return window.requestAnimationFrame(animate);
    }
    window.requestAnimationFrame(animate);
  }

  private cropRotate() {
    const props = this.properties.crop;
    const rotation = Math.PI / 2;
    props.bufferRotation += rotation;
    props.realRotation += rotation;
    if(!props.rotationAnimationInProgress) {
      this.cropRotateBuffer();
    }
  }

  public enableCropMode(): void {
    const props = this.properties.crop;
    props.enabled = true;
    this.canvasContainer.classList.add('crop-mode');
    props.panel.classList.add('active');

    const sin = Math.abs(Math.sin(props.rotation));
    const cos = Math.abs(Math.cos(props.rotation));

    this.canvas.width = this.sourceImage.width * cos + this.sourceImage.height * sin + 2 * Editor.imagePadding;
    this.canvas.height = this.sourceImage.width * sin + this.sourceImage.height * cos + 2 * Editor.imagePadding;

    props.canvas.width = this.canvas.width;
    props.canvas.height = this.canvas.height;

    const ctx = this.canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, Editor.imagePadding, Editor.imagePadding);

    const cropCtx = props.canvas.getContext('2d');
    cropCtx.setTransform(1, 0, 0, 1, Editor.imagePadding, Editor.imagePadding);

    // add event listeners
    this.canvas.onmousedown = this.cropCanvasMouseDown.bind(this);
    this.canvasContainer.onmouseup = this.cropCanvasMouseUp.bind(this);
    this.canvasContainer.onmousemove = this.cropCanvasMouseMove.bind(this);
    this.doCrop();
  }

  public cropFlip() {
    this.properties.crop.bufferMirror += -2 * this.properties.crop.realMirror;
    this.properties.crop.realMirror = -this.properties.crop.realMirror;

    let prevTimeStamp: number;

    const animate = (timeStamp: number) => {
      if(prevTimeStamp === undefined) {
        prevTimeStamp = timeStamp;
        return window.requestAnimationFrame(animate);
      }

      const elapsed = timeStamp - prevTimeStamp;
      if(elapsed == 0) {
        return window.requestAnimationFrame(animate);
      }

      if(Math.abs(this.properties.crop.bufferMirror) < 0.01) {
        this.properties.crop.bufferMirror = 0;
        this.properties.crop.mirrorAnimationInProgress = false;
        this.properties.crop.mirror = this.properties.crop.realMirror;
        this.doCrop();
        return;
      }
      const dm = this.properties.crop.bufferMirror / 4 * elapsed * 0.01;
      this.properties.crop.mirror += dm;
      this.properties.crop.bufferMirror -= dm;

      requestAnimationFrame(animate);
      this.doCrop();
    }

    if(!this.properties.crop.mirrorAnimationInProgress) {
      window.requestAnimationFrame(animate);
    }

    this.doCrop();
  }

  public disableCropMode(): void {
    const props = this.properties.crop;
    props.enabled = false;
    this.canvasContainer.classList.remove('crop-mode');
    props.panel.classList.remove('active');
    if(this.properties.crop.canvas === undefined) {
      return;
    }
    this.canvas.onmousedown = null;
    this.canvasContainer.onmouseup = null;
    this.canvasContainer.onmousedown = null;
    const ctx = this.canvas.getContext('2d');

    let [cropX, cropY, cropWidth, cropHeight] = [props.x, props.y, props.width, props.height];

    if(cropWidth < 0) {
      cropWidth = -cropWidth;
      cropX -= cropWidth;
    }
    if(cropHeight < 0) {
      cropHeight = -cropHeight;
      cropY -= cropHeight;
    }

    this.canvas.width = cropWidth;
    this.canvas.height = cropHeight;
    ctx.setTransform(1, 0, 0, 1, -cropX, -cropY);

    this.doCrop();
  }
}

export default Editor;
