import React from 'react';
import { act } from 'react';
import renderer from 'react-test-renderer';
import { ThemeProvider } from 'styled-components';
import BalanceWidget from '../BalanceWidget';
import theme from '../../../tailwind.config.js';

it('renders qualitative planner-friendly interface', () => {
  const considerations = [
    { name: 'Heritage', score: -0.55, details: 'Impact on listed building setting.' },
    { name: 'Housing Delivery', score: 0.82, details: '120 units in 3.2 year supply context.' },
  ];
  let tree;
  act(() => {
    tree = renderer.create(
      <ThemeProvider theme={theme.theme.extend}>
        <BalanceWidget considerations={considerations} />
      </ThemeProvider>
    );
  });
  expect(tree.toJSON()).toMatchSnapshot();
});
