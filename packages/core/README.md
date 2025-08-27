# @tpa/core

This package contains the core logic of The Planner's Assistant.

## Agent

The `Agent` class is the main entry point for the application. It takes a user query and returns a response.

## Usage

```javascript
import Agent from '@tpa/core/src/agent.js';

const agent = new Agent(apiKey);
const response = await agent.run(query);
```
