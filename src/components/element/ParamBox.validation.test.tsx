import {afterEach, expect, it, vi} from 'vitest';
import {cleanup, render, screen} from '@testing-library/react';
import ParamBox from './ParamBox';
afterEach(cleanup);
it('uses the field label as its name, and the tooltip as description', () => {
 render(<ParamBox label="SYN Threshold" value="100" raw onChange={vi.fn()} param_desc={{type: 'integer', description: 'SYN Threshold telemetry description'}} />);
 expect((screen.getByLabelText(/SYN Threshold/) as HTMLElement).tagName).toBe('INPUT');
 expect(screen.getByTitle('SYN Threshold telemetry description').contains(screen.getByLabelText('SYN Threshold'))).toBe(true);
});
it('reports changed validation even when enum metadata is unchanged', () => {
 const validation = vi.fn();
 const props = {label: 'Budget', value: '10', raw: true, onChange: vi.fn(), onValidation: validation, param_desc: {type: 'integer' as const}};
 const view = render(<ParamBox {...props} error={false} />);
 expect(validation).toHaveBeenLastCalledWith(true);
 view.rerender(<ParamBox {...props} error />);
 expect(validation).toHaveBeenLastCalledWith(false);
});
