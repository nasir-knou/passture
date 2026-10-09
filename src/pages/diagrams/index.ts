import type { ChoiceDiagram } from '../../types/question';
import { renderClockPageReplacementDiagram } from './clock-page-replacement';
import { renderDataTableDiagram } from './data-table';
import { renderMemoryFreeListDiagram } from './memory-free-list';
import { renderResourceAllocationGraphDiagram } from './resource-allocation-graph';
import { renderSimpleGraphDiagram } from './simple-graph';
import { renderUiWindowDiagram } from './ui-window';

export function renderDiagram(diagram: ChoiceDiagram, className: string): string {
  switch (diagram.type) {
    case 'resource-allocation-graph':
      return renderResourceAllocationGraphDiagram(diagram, className);
    case 'simple-graph':
      return renderSimpleGraphDiagram(diagram, className);
    case 'ui-window':
      return renderUiWindowDiagram(diagram, className);
    case 'memory-free-list':
      return renderMemoryFreeListDiagram(diagram, className);
    case 'data-table':
      return renderDataTableDiagram(diagram, className);
    case 'clock-page-replacement':
      return renderClockPageReplacementDiagram(diagram, className);
    default:
      return '';
  }
}
