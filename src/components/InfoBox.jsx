import { Card, CardActionArea, CardContent, Typography } from "@mui/material";
import { METRICS } from "../lib/metrics";
import "./InfoBox.css";

/** Join class names, dropping falsy entries (`false`/`undefined` never reach the DOM). */
const cx = (...names) => names.filter(Boolean).join(" ");

/**
 * A selectable statistic. Selecting one drives the colour and scale of the map
 * circles and the series shown in the chart.
 *
 * @param {object}   props
 * @param {string}   props.title    Human label, also used as the accessible name.
 * @param {string}   props.metric   Key into METRICS; sets the colour.
 * @param {string}   props.value    Preformatted figure, e.g. "777.6m".
 * @param {string}   props.context  Short line explaining what the figure counts.
 * @param {boolean}  [props.active] Whether this metric is the selected one.
 * @param {boolean}  [props.isLoading]
 * @param {Function} props.onSelect
 */
function InfoBox({ title, metric, active, value, context, isLoading, onSelect }) {
  return (
    <Card
      className={cx("infoBox", active && "infoBox--selected")}
      // One source for the figure's colour and the selected indicator, so they
      // can never drift apart. Cast because React's CSSProperties does not
      // model custom properties.
      style={/** @type {React.CSSProperties} */ ({ "--metric-color": METRICS[metric].hex })}
    >
      <CardActionArea
        onClick={() => onSelect()}
        aria-pressed={active}
        aria-label={`Show ${title.toLowerCase()} on the map and chart`}
      >
        <CardContent>
          <Typography className="infoBox__title" color="textSecondary">
            {title}
          </Typography>

          {/* Deliberately not a heading: this is a bare figure ("1.2m"), and
              exposing it to heading navigation announced a number with no
              context. The card's label lives on the button above. */}
          <p className="infoBox__value">
            {isLoading ? (
              <span
                className="infoBox__spinner"
                role="status"
                aria-label="Loading"
              />
            ) : (
              value
            )}
          </p>

          <Typography className="infoBox__context" color="textSecondary">
            {context}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

export default InfoBox;
