import { formatNumber } from "../util";
import "./Table.css";

function Table({ countries }) {
  return (
    <div className="table">
      <table>
        <caption className="table__caption">
          Countries ordered by total confirmed cases
        </caption>
        <tbody>
          {countries.map(({ country, cases, countryInfo }) => (
            <tr key={countryInfo?._id ?? country}>
              <td>{country}</td>
              <td>
                <strong>{formatNumber(cases)}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Table;
