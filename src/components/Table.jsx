import { METRICS } from "../lib/metrics";
import { formatNumber } from "../lib/format";
import "./Table.css";

/**
 * @param {object} props
 * @param {Array<import("../lib/metrics").Country>} props.countries
 * @param {import("../lib/metrics").MetricKey} props.metric
 * @param {string|null} [props.message] Shown instead of the rows, e.g. while
 *   the figures for a date range are still loading.
 */
function Table({ countries, metric, message = null }) {
  const { field, label } = METRICS[metric];

  return (
    <div className="table">
      {message ? (
        <p className="table__message" role="status">
          {message}
        </p>
      ) : (
        <table>
          <caption className="table__caption">
            Countries ordered by {label.toLowerCase()}
          </caption>
          <tbody>
            {countries.map((country) => (
              <tr key={country.code}>
                <td>{country.name}</td>
                <td>
                  <strong>{formatNumber(country[field])}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default Table;
