import {
  computeDagreLayout,
  type LayoutWorkerRequest,
  type LayoutWorkerResponse,
} from "./layoutDagreCore";

type WorkerScope = {
  onmessage: ((event: MessageEvent<LayoutWorkerRequest>) => void) | null;
  postMessage: (message: LayoutWorkerResponse) => void;
};

const ctx = self as unknown as WorkerScope;

ctx.onmessage = (event: MessageEvent<LayoutWorkerRequest>) => {
  const { requestId, ...request } = event.data;
  const result = computeDagreLayout(request);
  ctx.postMessage({ requestId, ...result });
};
