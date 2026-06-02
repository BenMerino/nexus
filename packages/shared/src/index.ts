// @nexus/shared — types shared between apps/web (render engine) and apps/api
// (backend Composer). Pure type interfaces only; no runtime exports, so neither
// app takes a build-time dependency. The chart data-shape vocabulary lives here
// (the contract a backend Composer emits and the frontend renders).
export type {
  GraphDataPoint, StackedGraphDataPoint, HeatmapDataPoint,
  ScatterDataPoint, WaterfallDataPoint, TreemapNode, ChartData,
} from "./graph-data.types.js";
