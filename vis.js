const margin = {top: 50, right: 25, bottom: 50, left: 25}

const chartAreaBBox = d3.select(".chartArea").node().getBoundingClientRect();
const width = chartAreaBBox.width - margin.left - margin.right;
const height = chartAreaBBox.height - margin.top - margin.bottom;

const max_rank = 20;
const square_padding = 10;
const square_size = (height - (max_rank - 1) * square_padding) / max_rank ;

let quarters = dataset.map(makeQuarterStr)
quarters = quarters.filter(function(item, pos) {
    return quarters.indexOf(item) == pos;
});
const x = d3.scaleBand().rangeRound([0, width]).domain(quarters);
const half_bandwidth = x.bandwidth() / 2;

const y = d3.scaleLinear()
  .domain([max_rank, 1])
  .range([height-20, 0]);

const chart = d3.select(".chartArea")
  .append("svg")
  .attr("width", width + margin.left + margin.right)
  .attr("height", height + margin.top + margin.bottom)
  .append("g")
  .attr("transform", "translate(" + margin.left + "," + margin.top + ")");


chart.append("clipPath")
  .attr("id", "clip")
  .append("rect")
  .attr("width", width)
  .attr("height", height);
 
const line = d3.line()
  .x(function(d) { return d.x })
  .y(function(d) { return d.y })
  .curve(d3.curveMonotoneX);
 
const spacing = x.bandwidth() / 3;

function makeQuarterStr(d) {
	return "" + d.year + d.quarter;
}

let selection_count = 0;

function makeSafeForCSS(name) {
    return 'cssSafe_' + name.replace(/[^a-z0-9]/g, function(s) {
        var c = s.charCodeAt(0);
        if (c == 32) return '_';
        if (c >= 65 && c <= 90) return '_' + s.toLowerCase();
        return '__' + ('000' + c.toString(16)).slice(-4);
    });
}

function formatCurrency(value) {
	// From https://stackoverflow.com/questions/149055/how-can-i-format-numbers-as-currency-string-in-javascript
	return value.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
}

function createToolTip(d) {
	const px = x(d.quarter_str) + half_bandwidth + margin.left - 50; 
	const py = y(d.rank) + margin.top - 90;
	const tooltip = d3.select(".tooltip")

	// Determine tooltip location

	tooltip.style("left", px + "px").style("top", py + "px").style("opacity", 1);
	tooltip.select(".teamname").text(d.key);
	tooltip.select(".quarterInfo").text(d.quarter_str.substring(0,4) + " " + d.quarter_str.substring(4, 6))
	tooltip.select(".moneyInfo").text("$" + formatCurrency(d.prizemoney));
	tooltip.select(".rankInfo").text("Rank: " + d.rank);
}

function removeToolTip(d) {
	d3.select(".tooltip").style("opacity", 0);
}

function highlight(d) {
  chart.selectAll("rect.unselected").transition().style("opacity", 0.1);
  chart.selectAll("rect.selected").transition().style("opacity", 1);
  chart.selectAll(".bezierLink.selected").transition().style("opacity", 1);
	chart.selectAll(".bezierLink.unselected").transition().style("opacity", 0);
  chart.selectAll("." + makeSafeForCSS(d.key)).transition().style("opacity", 1);
}

function unhighlight() {
  chart.selectAll(".bezierLink.selected").transition().style("opacity", 1);
	chart.selectAll(".bezierLink.unselected").transition().style("opacity", 0);
	if (selection_count == 0) {
  	chart.selectAll("rect").transition().style("opacity", 1);	
	} else {
  	chart.selectAll("rect.unselected").transition().style("opacity", 0.1);
	  chart.selectAll("rect.selected").transition().style("opacity", 1);
	}
}


function horizontalBezierLink(x1, y1, x2, y2, height1, height2) {
	const offset = 1; // To fix whitespace gaps
  const avg_x = (x1 + x2) / 2;
 
  const top_bezier = "C" +
        avg_x + " " + y1 + " " + // First control point
        avg_x + " " + y2 + " " + // Second control point
        (x2 + offset) + " " + y2 + " "; // Endpoint
  const bot_bezier = "C" +
        avg_x + " " + (y2 + height2) + " " + // First control point
        avg_x + " " + (y1 + height1) + " " + // Second control point
        (x1 - offset) + " " + (y1 + height1) + " "; // Endpoint
 
  return "M" + (x1 - offset) + " " + y1 + " " +
      top_bezier + "V" + (y2 + height2) + " " +
      bot_bezier + "Z";
}



d3.nest()
	.key(function (d) { return d.team_name; })
	.entries(dataset)
	.forEach(function(d, i) {
		let points = []
		let last_index = d.values.length - 1;
		
		d.values.forEach(function(dd, j) {
			const css_team_name = makeSafeForCSS(d.key)
			const team_color = team_colors[d.key] || "#ddd";
			const quarter_str = makeQuarterStr(dd);
		  const px = x(quarter_str) + half_bandwidth; // Add half bandwidth to correct for ordinal axis 
		  const py = y(dd.rank);
		  
		  
		  if (j < last_index) {  
				// Check for gaps
		    const next_quarter_str = quarters[quarters.indexOf(quarter_str) + 1];
		    const actual_next = d.values[j + 1];
				const actual_next_quarter_str = makeQuarterStr(actual_next)

		    if (actual_next_quarter_str == next_quarter_str) {	  
				  chart.append("path")
				    .classed(css_team_name, true)
				    .classed("bezierLink", true)
					  .classed("unselected", true)
				    .attr("d", horizontalBezierLink(
							px + square_size / 2, 
							py, 
							x(actual_next_quarter_str) + half_bandwidth - square_size / 2, 
							y(actual_next.rank), 
							square_size, 
							square_size
						))
						.style("stroke", team_color)
						.style("fill", team_color)
				    .attr("clip-path", "url(#clip)");
				} else {
					const prev_quarter_str = quarters[quarters.indexOf(actual_next_quarter_str) - 1];

		      // Down to oblivion
				  chart.append("path")
				    .classed(css_team_name, true)
				    .classed("bezierLink", true)
					  .classed("unselected", true)
				    .attr("d", horizontalBezierLink(
							px + square_size / 2, 
							py, 
							x(next_quarter_str) + half_bandwidth - square_size / 2, 
							y(max_rank * 1.25), 
							square_size, 
							0
						))
						.style("stroke", team_color)
						.style("fill", team_color)
				    .attr("clip-path", "url(#clip)");

					// Back from hell	
				  chart.append("path")
				    .classed(css_team_name, true)
				    .classed("bezierLink", true)
					  .classed("unselected", true)
				    .attr("d", horizontalBezierLink(
							x(actual_next_quarter_str) - half_bandwidth + square_size / 2, 
							y(max_rank * 1.25), 
							x(actual_next_quarter_str) + half_bandwidth - square_size / 2, 
							y(actual_next.rank), 
							0, 
							square_size
						))
						.style("stroke", team_color)
						.style("fill", team_color)
				    .attr("clip-path", "url(#clip)");
		    }
		  }
		  
			const rectData = {
				"key": d.key,
				"quarter_str": quarter_str,
				"rank": dd.rank,
				"prizemoney": dd.prizemoney
			}

		  chart.append("rect")
		    .datum(rectData)
		    .classed(css_team_name, true)
		    .classed("unselected", true)
		    .classed("scatterRect", true)
		    .attr("x", px - square_size / 2) 
		    .attr("y", py)
		    .attr("height", square_size)
		    .attr("width", square_size)
				.style("fill", team_color)
				.style("stroke", team_color)
		    .attr("clip-path", "url(#clip)")
		    .on("mouseover", function (d) {
					createToolTip(d);
					highlight(d);
				})
		    .on("mouseout", function (d) {
					removeToolTip();
					unhighlight(d);
				})
		})
		 
	});

chart.append("g")
    .attr("class", "x axis")
    .attr("transform", "translate(0," + height + ")")
    .call(
			d3.axisBottom(x)
			.tickFormat(function(d){
				return d.substring(4,6);
			})
		);
 
chart.append("g")
    .attr("class", "y axis")
    .call(d3.axisLeft(y));

let yearTicks = {};
let yearTickSize = 40;

quarters.forEach(function(q) {
	const year = q.substring(0,4);
	const quarter = q.substring(4,6);
	const quarter_x = x(q) + half_bandwidth; // Center of tick
	
	if (!yearTicks.hasOwnProperty(year)) {
		yearTicks[year] = [];
	} 

	yearTicks[year].push(quarter_x);

	if (q.endsWith("Q3")) {
		chart.append("image")
			.attr("href", "aegis.svg")
			.attr("width", "30")
			.attr("height", "30")
			.attr("x", quarter_x - 15)
			.attr("y", -35);
	}

	if (q.endsWith("Q4")) {
		chart.append("line")
			.attr("x1", quarter_x + half_bandwidth + 0.5) // Add 0.5 for thinner line
			.attr("y1", height)
			.attr("x2", quarter_x + half_bandwidth + 0.5)
			.attr("y2", height + yearTickSize)
			.style("stroke-width", 1)
			.style("stroke", "black");
	}
});

for (year in yearTicks) {
	const avgX = d3.mean(yearTicks[year]);
	chart.append("text")
		.classed("yearTick", true)
		.text(year)
		.attr("x", avgX)
		.attr("y", height+35)
		.attr("text-anchor","middle") 
}

/////////////////////////////// LEGEND ///////////////////////////////

const legendAreaBBox = d3.select(".legendArea").node().getBoundingClientRect();

const legend = d3.select(".legendArea")
const aspect = 120 / 50;

const legendItemsPerRow = 12;

const logoWidth = legendAreaBBox.width / legendItemsPerRow;
//const logoHeight = legendAreaBBox.height / Math.ceil(teamLogos.length / legendItemsPerRow);
const logoHeight = logoWidth / aspect;

teamLogos.forEach(function (d, i) {
	const itemData = d;
	itemData.key = d.team_name;

	legend.append("div")
		.datum(itemData)
		.classed("legendItem", true)
		.classed(makeSafeForCSS(d.key), true)
		.classed("unselected", true)
		.style("width", logoWidth + 8)
		.style("border-color", "white")
		.style("height", logoHeight + 8)
		.attr("halign", "center")
		.on("mouseover", highlight)
		.on("mouseout", unhighlight)
		.on("click", function(d) {
					const isSelected = d3.select(this).classed("selected");
					selection_count += isSelected ? -1 : 1;
					d3.select(this).style("border-color", isSelected ? "#fff" : team_colors[d.key] || "#ddd");
          d3.selectAll("." + makeSafeForCSS(d.key)).classed("selected", !isSelected);
					d3.selectAll("." + makeSafeForCSS(d.key)).classed("unselected", isSelected);
					unhighlight(d);
    })
		.append("img")
			.attr("src", d.team_logo_url)
			.style("max-width", logoWidth)
			.style("max-height", logoHeight)			
			.attr("width", "auto")
  		.attr("height", "auto");	

});

