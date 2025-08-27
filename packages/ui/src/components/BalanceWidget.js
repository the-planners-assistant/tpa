import React, { useState } from 'react';
import styled from 'styled-components';

const StyledSlider = styled.input`
  &::-webkit-slider-runnable-track {
    ${({ theme }) => theme.slider.track}
  }
  &::-webkit-slider-thumb {
    ${({ theme }) => theme.slider.thumb}
  }
`;

const BalanceWidget = ({ considerations, onWeightChange }) => {
  const [weights, setWeights] = useState(considerations.map(c => c.weight));

  const handleChange = (index, value) => {
    const newWeights = [...weights];
    newWeights[index] = value;
    setWeights(newWeights);
    onWeightChange(considerations[index].name, value);
  };

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-bold mb-4">Planning Balance</h3>
      <div>
        {considerations.map((consideration, index) => (
          <div key={consideration.name} className="mb-4">
            <label htmlFor={consideration.name} className="block text-sm font-medium text-gray-700">{consideration.name}</label>
            <StyledSlider
              type="range"
              id={consideration.name}
              name={consideration.name}
              min="0"
              max="100"
              value={weights[index]}
              onChange={(e) => handleChange(index, e.target.value)}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="text-center">{weights[index]}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BalanceWidget;