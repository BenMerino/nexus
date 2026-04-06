export interface GraphDataPoint {
  label: string;
  value: number;
  [key: string]: any;
}

export interface StackedGraphDataPoint {
  label: string;
  [key: string]: any;
}

export type ChartData = GraphDataPoint[] | StackedGraphDataPoint[];

export interface ColorScheme {
  sentiment: 'neutral' | 'positive' | 'negative';
  primary: string;
  fill: string;
  gradient?: string[];
  seriesColors?: string[];
}

export interface GraphThreshold {
  value: number;
  label: string;
  color: string;
}

export interface GraphInteraction {
  crosshair: 'both' | 'vertical' | 'none';
  dragRange: boolean;
  transitionMs: number;
  axes?: string;
}

export interface GraphDirective {
  type: string;
  title: string;
  data: ChartData;
  series?: string[];
  yLabel?: string;
  colorScheme?: ColorScheme;
  thresholds?: GraphThreshold[];
  interaction?: GraphInteraction;
  gaussian?: { mean: number; stddev: number };
  currencyConfig?: { currency?: string; currencyFormat?: string };
  renderContext?: string;
}

export function defaultInteraction(type: string): GraphInteraction {
  return {
    crosshair: type === 'sparkline' ? 'none' : 'both',
    dragRange: false,
    transitionMs: 0,
  };
}
