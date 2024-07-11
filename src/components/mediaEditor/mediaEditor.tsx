import renderImageFromUrl, {renderImageFromUrlPromise} from '../../helpers/dom/renderImageFromUrl';
import apiManagerProxy from '../../lib/mtproto/mtprotoworker';
import {createEffect, createSignal} from 'solid-js'
import Panel from './Panel';
import Editor from './Editor';
import {ButtonIconTsx} from '../buttonIconTsx';


const MediaEditor = (
  params: {
    parentElement: HTMLElement,
    file: File,
    saveModifiedFile: (file: File) => void
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
    <div ref={editorContainer}></div>
    <div ref={panelContainer}></div>
    <ButtonIconTsx onclick={async() => {
      params.saveModifiedFile(await editor.getModifiedFile(params.file.name))
      exitEditor();
    }} class="save" icon="check1"/>
  </>
};

export default MediaEditor;
