import { Application, ComponentTrait } from '@sunmao-ui/core';
import produce from 'immer';
import { tryOriginal } from '../../../operations/util';
import { BaseLeafOperation } from '../../type';

export type RemoveTraitLeafOperationContext = {
  componentId: string;
  index: number;
};

export class RemoveTraitLeafOperation extends BaseLeafOperation<RemoveTraitLeafOperationContext> {
  private deletedTrait!: ComponentTrait;
  do(prev: Application): Application {
    const componentIndex = prev.spec.components.findIndex(
      c => c.id === this.context.componentId
    );
    if (componentIndex === -1) {
      console.warn('component was removed');
      return prev;
    }
    return produce(prev, draft => {
      if (!draft.spec.components[componentIndex].traits[this.context.index]) {
        console.warn('trait not foudn');
        return;
      }
      this.deletedTrait = tryOriginal(
        draft.spec.components[componentIndex].traits.splice(this.context.index, 1)[0]
      );
    });
  }

  redo(prev: Application): Application {
    const componentIndex = prev.spec.components.findIndex(
      c => c.id === this.context.componentId
    );
    if (componentIndex === -1) {
      console.warn('component was removed');
      return prev;
    }
    return produce(prev, draft => {
      if (!draft.spec.components[componentIndex].traits[this.context.index]) {
        console.warn('trait not foudn');
        return;
      }
      draft.spec.components[componentIndex].traits.splice(this.context.index, 1);
    });
  }

  undo(prev: Application): Application {
    const componentIndex = prev.spec.components.findIndex(
      c => c.id === this.context.componentId
    );
    if (componentIndex === -1) {
      console.warn('component was removed');
      return prev;
    }
    return produce(prev, draft => {
      if (draft.spec.components[componentIndex].traits.length < this.context.index) {
        console.warn('corrupted index');
      }
      draft.spec.components[componentIndex].traits.splice(
        this.context.index,
        0,
        this.deletedTrait
      );
    });
  }
}