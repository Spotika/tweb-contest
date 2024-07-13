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

    const mainCtx = this.canvas.getContext('2d');

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
    const ctx = this.canvas.getContext('2d');

    const enhance = () => {
      const enhanceValue = this.enhanceValues.Enhance / 4;

      // Calculate the adjustment factors
      const contrast = 1 + (enhanceValue / 100); // Increase contrast
      const brightness = enhanceValue / 100 * 30; // Increase brightness
      const saturation = 1 + (enhanceValue / 100); // Increase saturation

      // Get image data
      const imageData = ctx.getImageData(0, 0, this.sourceImage.width, this.sourceImage.height);
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
      ctx.drawImage(this.sourceImage, 0, 0);
    }

    // apply all effects in specific order
    brightness();
    enhance();
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
