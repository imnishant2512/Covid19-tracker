import { useMemo } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from "chart.js";
import "chartjs-adapter-date-fns";
import { METRICS } from "../lib/metrics";
import { buildChartData, toTimestamp } from "../lib/chart";
import { formatAxisTick, formatDelta } from "../lib/format";
import { palette, paletteDark, withAlpha } from "../theme";
import { useColorScheme } from "../hooks/useColorScheme";
import "./LineGraph.css";

ChartJS.register(LinearScale, TimeScale, PointElement, LineElement, Filler, Tooltip);

/** @type {import("chart.js").ChartOptions<"line">} */
const options = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: "index", intersect: false },
  elements: { point: { radius: 0, hitRadius: 12 } },
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (context) => formatDelta(context.parsed.y),
      },
    },
  },
  scales: {
    x: {
      type: "time",
      // No fixed unit: Chart.js picks days/weeks/months to suit the range, so
      // short spans still get labelled instead of rendering a bare axis.
      time: { tooltipFormat: "MMM d, yyyy" },
      grid: { display: false },
      ticks: { maxRotation: 0, autoSkipPadding: 24 },
    },
    y: {
      grid: { display: false },
      ticks: {
        // Integer ticks only: Chart.js was otherwise free to pick fractional
        // ones (6.5, 6.8, 7.0) which all rounded to the same label.
        precision: 0,
        callback: formatAxisTick,
      },
    },
  },
};

/**
 * Weekly trend for the selected metric.
 *
 * @param {object}   props
 * @param {Array<[string, number, number]>} [props.weeks] [date, newCases, newDeaths]
 * @param {string}   props.metric      Key into METRICS.
 * @param {string}   [props.className]
 */
function LineGraph({ weeks, metric, className }) {
  const scheme = useColorScheme();
  const points = useMemo(
    () => buildChartData(weeks, metric).map(({ x, y }) => ({ x: toTimestamp(x), y })),
    [weeks, metric]
  );

  if (points.length === 0) {
    return (
      <div className={className}>
        <p className="lineGraph__message" role="status">
          Loading chart…
        </p>
      </div>
    );
  }

  // The chart draws to a canvas on the card surface, so it needs the palette
  // for the active scheme. The map keeps the light palette regardless, because
  // its circles sit on light OpenStreetMap tiles either way.
  const { weekIndex } = METRICS[metric];
  const hex = (scheme === "dark" ? paletteDark : palette)[metric];
  const seriesLabel = weekIndex === 2 ? "New deaths" : "New cases";

  return (
    <div className={className}>
      <Line
        data={{
          datasets: [
            {
              label: seriesLabel,
              // Match the map, which colours its circles by the same metric.
              backgroundColor: withAlpha(hex, 0.5),
              borderColor: hex,
              borderWidth: 2,
              fill: true,
              data: points,
            },
          ],
        }}
        options={options}
      />
    </div>
  );
}

export default LineGraph;
