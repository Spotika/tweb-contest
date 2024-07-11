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
  let panel: Panel;
  let editorContainer: HTMLDivElement;
  let panelContainer: HTMLDivElement;

  createEffect(() => {
    editor = new Editor(params.file, editorContainer);
    panel = new Panel(panelContainer, exitEditor);
  });

  const exitEditor = () => {
    params.parentElement.remove();
  }

  return <>
    {/* <canvas ref={canvas}></canvas> */}
    {/* <Editor file={params.file}/> */}
    <div ref={editorContainer}></div>
    <div ref={panelContainer}></div>
    {/* <Panel close={exitEditor}/> */}
    {/* <button onclick={() => {exitEditor(true)}}> image</button> */}
  </>
};

export default MediaEditor;
