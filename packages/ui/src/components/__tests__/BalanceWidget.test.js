import React from 'react';
import { act } from 'react';
import renderer from 'react-test-renderer';
import { ThemeProvider } from 'styled-components';
import BalanceWidget from '../BalanceWidget';
import theme from '../../../tailwind.config.js';

it('renders correctly', () => {
  const considerations = [
    { name: 'Heritage', weight: 50 },
    { name: 'Housing Delivery', weight: 70 },
  ];
  let tree;
  act(() => {
    tree = renderer.create(
      <ThemeProvider theme={theme.theme.extend}>
        <BalanceWidget considerations={considerations} onWeightChange={() => {}} />
      </ThemeProvider>
    );
  });
  expect(tree.toJSON()).toMatchSnapshot();
});
