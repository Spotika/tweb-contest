import renderImageFromUrl, {renderImageFromUrlPromise} from '../../helpers/dom/renderImageFromUrl';
import apiManagerProxy from '../../lib/mtproto/mtprotoworker';
import {createEffect, createSignal} from 'solid-js'
import Panel from './Panel';
import Editor from './Editor';


const MediaEditor = (
  params: {
    parentElement: HTMLElement,
    file: File,
    save_modified_file: (file: File) => void
  }
) => {
  let editor: Editor;
  let editorContainer: HTMLDivElement;

  createEffect(() => {
    editor = new Editor(params.file, editorContainer);
  });

  return <>
    {/* <canvas ref={canvas}></canvas> */}
    {/* <Editor file={params.file}/> */}
    <div ref={editorContainer}></div>
    <Panel/>
    {/* <button onclick={() => {exitEditor(true)}}> image</button> */}
  </>
};

export default MediaEditor;
