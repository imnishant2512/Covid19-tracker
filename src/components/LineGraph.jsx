import { useEffect, useMemo, useState } from "react";
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
import { parse } from "date-fns";
import numeral from "numeral";
import { fetchHistorical, isAbort } from "../api";
import { buildChartData, casesTypeColors, withAlpha } from "../util";

ChartJS.register(LinearScale, TimeScale, PointElement, LineElement, Filler, Tooltip);

const LAST_DAYS = 120;

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

/** disease.sh returns dates as "M/D/YY" — parse explicitly rather than trusting Date(). */
const toTimestamp = (date) => parse(date, "M/d/yy", new Date()).getTime();

function LineGraph({ casesType, className }) {
  const [history, setHistory] = useState(null);
  const [error, setError] = useState(null);

  // The historical endpoint returns cases, recovered AND deaths in one payload,
  // so this fetches once on mount rather than on every tab change.
  useEffect(() => {
    const controller = new AbortController();

    fetchHistorical(LAST_DAYS, controller.signal)
      .then((data) => {
        setHistory(data);
        setError(null);
      })
      .catch((err) => {
        if (isAbort(err)) return;
        setError(err);
      });

    return () => controller.abort();
  }, []);

  const points = useMemo(() => {
    if (!history) return [];
    return buildChartData(history, casesType).map(({ x, y }) => ({
      x: toTimestamp(x),
      y,
    }));
  }, [history, casesType]);

  if (error) {
    return (
      <div className={className}>
        <p className="lineGraph__message" role="status">
          Chart data is unavailable right now.
        </p>
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div className={className}>
        <p className="lineGraph__message" role="status">
          Loading chart…
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <Line
        data={{
          datasets: [
            {
              label: `New ${casesType}`,
              // Match the map, which colours its circles by the same metric.
              backgroundColor: withAlpha(casesTypeColors[casesType].hex, 0.5),
              borderColor: casesTypeColors[casesType].hex,
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
