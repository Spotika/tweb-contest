import renderImageFromUrl, {renderImageFromUrlPromise} from '../../helpers/dom/renderImageFromUrl';
import apiManagerProxy from '../../lib/mtproto/mtprotoworker';
import {createEffect, createSignal} from 'solid-js'


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

  private ctx: CanvasRenderingContext2D;

  constructor(file: File, render_element: HTMLElement) {
    this.itemDiv = document.createElement('div');
    this.itemDiv.classList.add('editor-container');
    this.canvas = document.createElement('canvas');

    this.ctx = this.canvas.getContext('2d');

    this.itemDiv.append(this.canvas);
    render_element.replaceWith(this.itemDiv);

    (async() => {
      const img = new Image();
      const url = await apiManagerProxy.invoke('createObjectURL', file);
      await renderImageFromUrlPromise(img, url);
      // draw image on canvas
      this.canvas.width = img.width;
      this.canvas.height = img.height;
      this.ctx.drawImage(img, 0, 0);
    })().then();
  }

  public async getModifiedFile(new_file_name: string): Promise<File> {
    return fetch(this.canvas.toDataURL())
    .then(res => res.blob())
    .then(blob => {
      const file = new File([blob], new_file_name, blob);
      return file;
    });
  }
}

export default Editor;
