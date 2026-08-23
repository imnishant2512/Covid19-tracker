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
import numeral from "numeral";
import { METRICS, buildChartData, withAlpha } from "../util";

ChartJS.register(LinearScale, TimeScale, PointElement, LineElement, Filler, Tooltip);

const options = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: "index", intersect: false },
  elements: { point: { radius: 0, hitRadius: 12 } },
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (context) => numeral(context.parsed.y).format("+0,0"),
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
        // Integer ticks only, and abbreviate just the large ones. Formatting
        // everything as "0a" collapsed small ranges into repeated labels
        // (6.5, 7.0 and 7.4 all rendered as "7").
        precision: 0,
        callback: (value) =>
          Math.abs(value) >= 1000
            ? numeral(value).format("0.[0]a")
            : numeral(value).format("0,0"),
      },
    },
  },
};

function LineGraph({ weeks, metric, className }) {
  // The snapshot ships ISO dates, which the date adapter parses directly — the
  // previous source used "M/D/YY" strings that needed explicit parsing.
  const points = useMemo(
    () =>
      buildChartData(weeks, metric).map(({ x, y }) => ({
        x: new Date(`${x}T00:00:00Z`).getTime(),
        y,
      })),
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

  const { hex, weekIndex } = METRICS[metric];
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
