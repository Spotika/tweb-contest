import renderImageFromUrl, {renderImageFromUrlPromise} from '../../helpers/dom/renderImageFromUrl';
import apiManagerProxy from '../../lib/mtproto/mtprotoworker';
import {createEffect, createSignal} from 'solid-js'
import {EditEvent, EnhanceEvent, EnhanceFilters} from './panel';

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

class Editor {
  public canvas: HTMLCanvasElement;
  public itemDiv: HTMLElement;

  private sourceImage: HTMLImageElement;
  private canvasContainer: HTMLDivElement;
  private cropPanel: HTMLDivElement;
  private onFreeCallback: () => void;

  private enhanceValues: {
    [key in EnhanceEvent['filter']]: number;
  } = {} as any;

  constructor(file: File, renderElement: HTMLElement) {
    this.itemDiv = document.createElement('div');
    this.itemDiv.classList.add('editor-container');

    this.canvasContainer = document.createElement('div');
    this.canvasContainer.classList.add('canvas-container');

    this.itemDiv.append(this.canvasContainer);

    this.createCropPanel();

    this.canvas = document.createElement('canvas');

    const mainCtx = this.canvas.getContext('2d', {willReadFrequently: true});
    mainCtx.fillStyle = `rgba(255, 255, 255, 0)`;

    this.canvasContainer.append(this.canvas);
    renderElement.replaceWith(this.itemDiv);

    createEffect(async() => {
      this.sourceImage = new Image();
      const url = await apiManagerProxy.invoke('createObjectURL', file);
      await renderImageFromUrlPromise(this.sourceImage, url);

      // draw image on main canvas
      this.canvas.width = this.sourceImage.width;
      this.canvas.height = this.sourceImage.height;
      mainCtx.fillRect(0, 0, this.sourceImage.width, this.sourceImage.height);
      mainCtx.fillStyle = `rgba(255, 255, 255, 0)`;
      mainCtx.drawImage(this.sourceImage, 0, 0);

      // creating enhanceCanvases
      for(const filter of EnhanceFilters) {
        this.enhanceValues[filter] = 0;
      }
    });
  }

  public processEvent(e: EditEvent) {
    switch(e.type) {
      case 'enhance':
        this.enhanceValues[e.filter] = e.value;
        this.doEnhance();
        break;
      case 'crop':
        this.doCrop(e.data);
    }
  }

  private doEnhance() {
    const ctx = this.canvas.getContext('2d', {willReadFrequently: true});
    const [width, height] = [this.sourceImage.width, this.sourceImage.height];
    ctx.drawImage(this.sourceImage, 0, 0);

    const enhance = () => {
      const enhanceValue = this.enhanceValues.Enhance / 4;

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
      ctx.filter = `brightness(${this.enhanceValues.Brightness + 100}%)`;
      ctx.drawImage(ctx.canvas, 0, 0);
    }

    const contrast = () => {
      const imgData = ctx.getImageData(0, 0, width, height);
      const d = imgData.data;
      const value = (this.enhanceValues.Contrast/100) + 1;
      var intercept = 128 * (1 - value);
      for(var i = 0; i < d.length; i += 4) {
        d[i] = d[i]*value + intercept;
        d[i+1] = d[i+1]*value + intercept;
        d[i+2] = d[i+2]*value + intercept;
      }
      ctx.putImageData(imgData, 0, 0);
    }

    const saturation = () => {
      var imageData = ctx.getImageData(0, 0, width, height);
      const dA = imageData.data; // raw pixel data in array

      const sv = this.enhanceValues.Saturation / 100 + 1; // saturation value. 0 = grayscale, 1 = original

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
      const value = -this.enhanceValues.Warmth / 5;
      for(var i = 0; i < d.length; i += 4) {
        d[i] = Math.min(255, Math.max(0, d[i] - value));
        d[i+2] = Math.min(255, Math.max(0, d[i + 2] + value));
      }
      ctx.putImageData(imgData, 0, 0);
    }

    const fade = () => {
      ctx.rect(0, 0, width, height);
      const value = this.enhanceValues.Fade / 300;
      ctx.fillStyle = `rgba(255, 255, 255, ${value})`;
      ctx.fill();
    }

    const highlightsAndShadows = () => {
      const imgData = ctx.getImageData(0, 0, width, height);
      const d = imgData.data;
      const highlights = this.enhanceValues.Highlights / 500;
      const shadows = -this.enhanceValues.Shadows / 500;


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
      // we have to find luminance of the pixel
      // here 0.0 <= source.r/source.g/source.b <= 1.0
      // and 0.0 <= luminance <= 1.0
      // here highlights and and shadows are our desired filter amounts
      // highlights/shadows should be >= -1.0 and <= +1.0
      // highlights = shadows = 0.0 by default
      // you can change 0.05 and 8.0 according to your needs but okay for me
    }

    const vingette = () => {
      // ctx.clearRect(0, 0, width, height);

      // create radial gradient
      var outerRadius = width * .6;
      var innerRadius = width * .05;
      var grd = ctx.createRadialGradient(width / 2, height / 2, innerRadius, width / 2, height / 2, outerRadius);
      // light blue
      grd.addColorStop(0, 'rgba(0,0,0,0)');
      // dark blue
      grd.addColorStop(1, 'rgba(0,0,0,' + this.enhanceValues.Vingette / 150 + ')');

      ctx.fillStyle = grd;
      ctx.fill();
    }

    const grain = () => {
      const imgData = ctx.getImageData(0, 0, width, height);
      const d = imgData.data;
      const amount = this.enhanceValues.Grain / 5;

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
      const mix = this.enhanceValues.Sharpen / 50;
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
    grain();
    sharpen();
  }

  private doCrop(data: string) {
    // console.log(data);
  }

  public async getModifiedFile(newFileName: string): Promise<File> {
    return fetch(this.canvas.toDataURL())
    .then(res => res.blob())
    .then(blob => {
      const file = new File([blob], newFileName, blob);
      return file;
    });
  }

  public linkCropFreeCallback(callback: () => void) {
    this.onFreeCallback = callback;
  }

  private createCropPanel() {
    this.cropPanel = document.createElement('div');
    this.cropPanel.classList.add('crop-panel');
    this.itemDiv.append(this.cropPanel);
  }

  public enableCropMode(): void {
    this.canvasContainer.classList.add('crop-mode');
    this.cropPanel.classList.add('active');
  }

  public disableCropMode(): void {
    this.canvasContainer.classList.remove('crop-mode');
    this.cropPanel.classList.remove('active');
  }
}

export default Editor;
