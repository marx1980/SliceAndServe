import { computeHints } from './hints';
import { analyzeFailure } from './failure';
import type { AnalysisRequest, AnalysisResponse } from './client';

// Heavy solver work runs here so the UI thread never blocks.
const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<AnalysisRequest>) => void) | null;
  postMessage(message: AnalysisResponse): void;
};

ctx.onmessage = (e) => {
  const req = e.data;
  if (req.type === 'hints') {
    ctx.postMessage({ id: req.id, type: 'hints', result: computeHints(req.state) });
  } else {
    ctx.postMessage({
      id: req.id,
      type: 'failure',
      result: analyzeFailure(req.states, req.moves),
    });
  }
};
