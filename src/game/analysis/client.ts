import type { GameState, Command } from '../model/types';
import type { FailureReport } from './failure';
import { analyzeFailure } from './failure';
import type { HintData } from './hints';
import { computeHints } from './hints';

export type AnalysisRequest =
  | { id: number; type: 'hints'; state: GameState }
  | { id: number; type: 'failure'; states: GameState[]; moves: Command[] };

export type AnalysisResponse =
  | { id: number; type: 'hints'; result: HintData }
  | { id: number; type: 'failure'; result: FailureReport };

let worker: Worker | null = null;
let nextId = 1;
const waiting = new Map<number, (r: AnalysisResponse) => void>();

function getWorker(): Worker | null {
  if (worker) return worker;
  if (typeof Worker === 'undefined' || import.meta.env.VITE_NO_WORKER) return null;
  try {
    worker = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<AnalysisResponse>) => {
      const done = waiting.get(e.data.id);
      waiting.delete(e.data.id);
      done?.(e.data);
    };
    worker.onerror = () => {
      // Fall back to the main thread for later requests.
      worker = null;
    };
  } catch {
    worker = null;
  }
  return worker;
}

function request(
  build: (id: number) => AnalysisRequest,
  inline: () => AnalysisResponse['result'],
): Promise<AnalysisResponse['result']> {
  const w = getWorker();
  const id = nextId++;
  if (!w) {
    return new Promise((resolve) => setTimeout(() => resolve(inline()), 0));
  }
  return new Promise((resolve) => {
    waiting.set(id, (r) => resolve(r.result));
    w.postMessage(build(id));
  });
}

export function requestHints(state: GameState): Promise<HintData> {
  return request(
    (id) => ({ id, type: 'hints', state }),
    () => computeHints(state),
  ) as Promise<HintData>;
}

export function requestFailure(states: GameState[], moves: Command[]): Promise<FailureReport> {
  return request(
    (id) => ({ id, type: 'failure', states, moves }),
    () => analyzeFailure(states, moves),
  ) as Promise<FailureReport>;
}
