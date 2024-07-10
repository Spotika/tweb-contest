import renderImageFromUrl, {renderImageFromUrlPromise} from '../../helpers/dom/renderImageFromUrl';
import apiManagerProxy from '../../lib/mtproto/mtprotoworker';
import {createEffect, createSignal} from 'solid-js'
import Icon from '../icon';
import {ButtonIconTsx} from '../buttonIconTsx';


const Panel = () => {
  return <div class="editor-panel">
    <div class="navbar-tabs">
      <div class="navbar">
        <div class="navbar-left">
          <ButtonIconTsx icon='close' class="close"/>
          <div class="title">Edit</div>
        </div>
        <div class="actions">
          <ButtonIconTsx icon='undo'/>
          <ButtonIconTsx icon='redo'/>
        </div>
      </div>
      <div class="tabs"></div>
    </div>
  </div>
};

export default Panel;
