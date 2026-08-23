import { METRICS } from "../lib/metrics";
import { formatNumber } from "../lib/format";
import "./Table.css";

function Table({ countries, metric }) {
  const { field, label } = METRICS[metric];

  return (
    <div className="table">
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
    </div>
  );
}

export default Table;
