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
    const mainCtx = this.canvas.getContext('2d');

    // Brightness
    mainCtx.filter = `brightness(${this.enhanceValues.Brightness + 100}%)`;
    mainCtx.drawImage(this.sourceImage, 0, 0);
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
