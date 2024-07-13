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

  private enhanceValues: {
    [key in EnhanceEvent['filter']]: number;
  } = {} as any;

  constructor(file: File, renderElement: HTMLElement) {
    this.itemDiv = document.createElement('div');
    this.itemDiv.classList.add('editor-container');
    this.canvas = document.createElement('canvas');

    const mainCtx = this.canvas.getContext('2d', {willReadFrequently: true});
    mainCtx.fillStyle = `rgba(255, 255, 255, 0)`;

    this.itemDiv.append(this.canvas);
    renderElement.replaceWith(this.itemDiv);

    createEffect(async() => {
      this.sourceImage = new Image();
      const url = await apiManagerProxy.invoke('createObjectURL', file);
      await renderImageFromUrlPromise(this.sourceImage, url);

      // draw image on main canvas
      this.canvas.width = this.sourceImage.width;
      this.canvas.height = this.sourceImage.height;
      mainCtx.drawImage(this.sourceImage, 0, 0);

      // creating enhanceCanvases
      for(const filter of EnhanceFilters) {
        this.enhanceValues[filter] = 0;
      }
      this.doEnhance();
      this.doEnhance();
    });
  }

  public processEvent(e: EditEvent) {
    switch(e.type) {
      case 'enhance':
        this.enhanceValues[e.filter] = e.value;
        this.doEnhance();
        break;
    }
  }

  private doEnhance() {
    const ctx = this.canvas.getContext('2d', {willReadFrequently: true});
    const [width, height] = [this.sourceImage.width, this.sourceImage.height];
    ctx.drawImage(this.sourceImage, 0, 0);
    // ctx.fillRect(0, 0, width, height);

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
      const value = this.enhanceValues.Fade / 300;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = `rgba(255, 255, 255, ${value})`;
    }

    // apply all effects in specific order
    enhance();
    contrast();
    brightness();
    saturation();
    warmth();
    fade();
  }

  public async getModifiedFile(newFileName: string): Promise<File> {
    return fetch(this.canvas.toDataURL())
    .then(res => res.blob())
    .then(blob => {
      const file = new File([blob], newFileName, blob);
      return file;
    });
  }
}

export default Editor;
